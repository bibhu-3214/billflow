"""Recurring plans prepare drafts; they never issue or charge an invoice."""

from calendar import monthrange
from datetime import date, timedelta

from .rules import DomainError, require, valid_date


def next_review_date(due, cadence, anchor, as_of):
    start = date.fromisoformat(valid_date(due))
    current = date.fromisoformat(valid_date(as_of))
    if isinstance(anchor, bool) or not isinstance(anchor, int) or not 1 <= anchor <= 31:
        raise DomainError("Invalid monthly anchor.")
    try:
        if cadence == "weekly":
            result = start + timedelta(days=max(1, (current - start).days // 7 + 1) * 7)
        elif cadence == "monthly":
            months = max(1, (current.year - start.year) * 12 + current.month - start.month)

            def candidate(offset):
                index = start.year * 12 + start.month - 1 + offset
                year, month = divmod(index, 12)
                return date(year, month + 1, min(anchor, monthrange(year, month + 1)[1]))

            result = candidate(months)
            if result <= current:
                result = candidate(months + 1)
        else:
            raise DomainError("Choose a weekly or monthly cadence.")
        return result.isoformat()
    except (ValueError, OverflowError) as error:
        raise DomainError("The next schedule date is outside the supported range.") from error


def recurrence_fields(value, state, customer):
    if value is None:
        return None
    if (
        not isinstance(value, dict)
        or set(value) != {"invoiceId", "cadence", "anchorDay"}
        or value["cadence"] not in ["weekly", "monthly"]
        or isinstance(value["anchorDay"], bool)
        or not isinstance(value["anchorDay"], int)
        or not 1 <= value["anchorDay"] <= 31
    ):
        raise DomainError("Choose valid recurring invoice details.")
    source = require(state["bills"], value["invoiceId"])
    if source["customer"] != customer:
        raise DomainError("Choose an invoice for this customer.")
    return {
        "invoiceId": source["_id"],
        "cadence": value["cadence"],
        "anchorDay": value["anchorDay"],
    }


def recurring_draft(record, state, as_of):
    current = valid_date(as_of)
    if record["status"] != "open" or not record.get("recurrence") or record["dueDate"] > current:
        raise DomainError("This recurring plan is paused or is not due yet.")
    recurrence = recurrence_fields(record["recurrence"], state, record["customer"])
    source = require(state["bills"], recurrence["invoiceId"])
    if source.get("cancellation") or source.get("creditNote"):
        raise DomainError("The source invoice was cancelled or credited. Choose another source.")
    customer = require(state["customers"], record["customer"])
    term = max(
        0,
        (
            date.fromisoformat((source.get("dueDate") or source["date"])[:10])
            - date.fromisoformat(source["date"][:10])
        ).days,
    )
    try:
        due = (date.fromisoformat(current) + timedelta(days=term)).isoformat()
    except (ValueError, OverflowError) as error:
        raise DomainError("The payment date is outside the supported range.") from error
    items = []
    for item in source["lineItems"]:
        product = require(state["products"], item["product"])
        items.append(
            {
                "product": product["_id"],
                "quantity": item["quantity"],
                "discount": item.get("discount", 0),
                "gstRate": product.get("gstRate", ""),
                "unit": product.get("unit") or "NOS",
                "hsn": product.get("hsn", ""),
            }
        )
    if not items:
        raise DomainError("The source invoice has no products.")
    values = {
        "title": record["title"],
        "customer": record["customer"],
        "date": current,
        "dueDate": due,
        "billingAddress": customer.get("address")
        or source.get("customerSnapshot", {}).get("address", ""),
        "notes": source.get("notes", ""),
        "gst": source.get("gst", False),
        "supplierGSTIN": state["settings"].get("gstin")
        or source.get("supplierSnapshot", {}).get("gstin", ""),
        "customerGSTIN": customer.get("gstin", ""),
        "supplierState": source.get("supplierState", ""),
        "placeOfSupply": source.get("placeOfSupply", ""),
        "lineItems": items,
    }
    return values, next_review_date(
        record["dueDate"], recurrence["cadence"], recurrence["anchorDay"], current
    )
