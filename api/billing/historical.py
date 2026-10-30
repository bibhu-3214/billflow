"""Reviewed imports of historical purchases; these never create invoices or payments."""

import re
from copy import deepcopy
from datetime import datetime

from .rules import DomainError, number, text, valid_date


def phone_key(value):
    return re.sub(r"[ ()-]", "", value)


def source_rows(payload):
    if (
        not isinstance(payload, dict)
        or set(payload) != {"version", "product", "records"}
        or payload.get("version") != 1
        or payload.get("product") not in ["customer-insights", "customer-desk"]
    ):
        raise DomainError("Choose a Customer Insights export.")
    records = payload["records"]
    if not isinstance(records, list) or len(records) > 10000:
        raise DomainError("An import supports up to 10,000 purchases.")
    seen = set()
    result = []
    for row in records:
        if not isinstance(row, dict) or set(row) != {
            "id",
            "createdAt",
            "updatedAt",
            "name",
            "phone",
            "date",
            "amountMinor",
        }:
            raise DomainError("Invalid historical purchase fields.")
        identity = text(row.get("id"), "Source ID", 80)
        if not re.fullmatch(r"[A-Za-z0-9_-]+", identity) or identity in seen:
            raise DomainError("Source IDs must be unique and valid.")
        seen.add(identity)
        name = text(row.get("name"), "Customer name", 100)
        phone = text(row.get("phone"), "Phone number", 25)
        if (
            not re.fullmatch(r"\+?[\d ()-]{7,25}", phone)
            or not 7 <= len(re.sub(r"\D", "", phone)) <= 15
        ):
            raise DomainError("Invalid historical phone number.")
        valid_date(row.get("date"))
        number(row.get("amountMinor"), 1, 100_000_000_000, True)
        for key in ["createdAt", "updatedAt"]:
            try:
                stamp = datetime.fromisoformat(
                    text(row.get(key), "Timestamp", 40).replace("Z", "+00:00")
                )
                if stamp.tzinfo is None:
                    raise ValueError()
            except ValueError as exc:
                raise DomainError("Historical timestamps require a timezone.") from exc
        result.append({**row, "name": name, "phone": phone})
    return result


def plan(payload, current, customers, links):
    rows = source_rows(payload)
    if not isinstance(links, dict) or len(links) > 10000:
        raise DomainError("Invalid customer links.")
    phones = {phone_key(row["phone"]) for row in rows}
    customer_ids = {row["_id"] for row in customers}
    if any(
        key not in phones or not isinstance(value, str) or (value and value not in customer_ids)
        for key, value in links.items()
    ):
        raise DomainError("A selected customer is unavailable in this business.")
    existing = {row["_id"] for row in current}
    pending = []
    duplicates = 0
    for row in rows:
        identity = "insight_" + row["id"]
        if identity in existing:
            duplicates += 1
            continue
        pending.append(
            {
                "_id": identity,
                "source": "customer-insights",
                "sourceId": row["id"],
                "name": row["name"],
                "phone": row["phone"],
                "date": row["date"],
                "amountMinor": row["amountMinor"],
                "customerId": links.get(phone_key(row["phone"]), ""),
                "createdAt": row["createdAt"],
                "updatedAt": row["updatedAt"],
            }
        )
    if len(current) + len(pending) > 10000:
        raise DomainError("The historical sales limit is 10,000 records.")
    return {"records": pending, "duplicates": duplicates, "sourceCount": len(rows)}


def validate_saved(rows, customers):
    if not isinstance(rows, list) or len(rows) > 10000:
        raise DomainError("Invalid historical sales collection.")
    required = {
        "_id",
        "source",
        "sourceId",
        "name",
        "phone",
        "date",
        "amountMinor",
        "customerId",
        "createdAt",
        "updatedAt",
    }
    for row in rows:
        if (
            not isinstance(row, dict)
            or set(row) != required
            or row["source"] != "customer-insights"
            or not isinstance(row["sourceId"], str)
            or row["_id"] != "insight_" + row["sourceId"]
        ):
            raise DomainError("Invalid historical sale identity.")
    source = [
        {
            "id": row["sourceId"],
            **{
                key: row[key]
                for key in ["name", "phone", "date", "amountMinor", "createdAt", "updatedAt"]
            },
        }
        for row in rows
    ]
    source_rows({"version": 1, "product": "customer-insights", "records": source})
    ids = {row["_id"] for row in customers}
    if any(
        not isinstance(row["customerId"], str)
        or (row["customerId"] and row["customerId"] not in ids)
        for row in rows
    ):
        raise DomainError("A historical sale links to a missing customer.")
    return deepcopy(rows)
