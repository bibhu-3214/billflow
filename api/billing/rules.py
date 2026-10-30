"""Authoritative domestic billing rules. Money is calculated in integer paise."""

import re
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone

STATES = {f"{n:02d}" for n in [*range(1, 25), 26, 27, *range(29, 39)]}
COLLECTIONS = [
    "customers",
    "products",
    "bills",
    "invoiceDrafts",
    "quotations",
    "invoiceTemplates",
    "stockRecords",
    "followUps",
    "historicalSales",
]


class DomainError(Exception):
    status = 400


class Conflict(DomainError):
    status = 409


def uid(prefix):
    return prefix + "_" + uuid.uuid4().hex


def now():
    return timezone.now().isoformat()


def today():
    return timezone.localdate().isoformat()


def text(value, label="Text", limit=120, required=True):
    if value is None and not required:
        return ""
    if not isinstance(value, str) or len(value.strip()) > limit or (required and not value.strip()):
        raise DomainError(f"{label} is invalid.")
    return value.strip()


def optional(value, label="Text", limit=120):
    return text(value, label, limit, False)


def number(value, low=0, high=100000000, integer=False):
    if isinstance(value, bool) or value is None or value == "":
        raise DomainError("Enter a valid number.")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise DomainError("Enter a valid number.") from exc
    if not result.is_finite() or not low <= result <= high or (integer and result != int(result)):
        raise DomainError("Number is outside the supported range.")
    return result


def rounded(value):
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def paise(value):
    return rounded(number(value, 0, 1000000000000) * 100)


def money(value):
    return float(Decimal(value) / 100)


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise DomainError("Choose a valid date.")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise DomainError("Choose a valid date.") from exc
    if parsed.year < 1900 or parsed.year > 9998:
        raise DomainError("Choose a date between 1900 and 9998.")
    return value


def financial_year(value):
    valid_date(value)
    year = int(value[:4]) - (int(value[5:7]) < 4)
    return f"{year % 100:02d}{(year + 1) % 100:02d}"


def gstin(value):
    if (
        not isinstance(value, str)
        or not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]", value)
        or value[:2] not in STATES
    ):
        return False
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    total = 0
    for i, char in enumerate(value[:14]):
        product = alphabet.index(char) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return alphabet[(36 - total % 36) % 36] == value[14]


def tax_identity(values):
    state = optional(values.get("state"), "State", 2)
    tax = optional(values.get("gstin"), "GSTIN", 15).upper()
    if state and state not in STATES:
        raise DomainError("Select a valid state.")
    if tax and (not gstin(tax) or tax[:2] != state):
        raise DomainError("GSTIN must be valid and match the selected state.")
    return {"state": state, "gstin": tax}


def customer_fields(v):
    email = optional(v.get("email"), "Email", 254).lower()
    if email:
        try:
            validate_email(email)
        except ValidationError as exc:
            raise DomainError("Customer email is invalid.") from exc
    return {
        "name": text(v.get("name"), "Customer name", 100),
        "email": email,
        "mobile": text(v.get("mobile"), "Phone number", 20),
        **tax_identity(v),
        **{
            key: optional(v.get(key), key, size)
            for key, size in [
                ("company", 120),
                ("contactPerson", 120),
                ("address", 500),
                ("notes", 1000),
            ]
        },
    }


def product_fields(v):
    price = number(v.get("price"), Decimal("0.01"), 100000000)
    hsn = optional(v.get("hsn"), "HSN/SAC", 8)
    if hsn and not re.fullmatch(r"\d{4,8}", hsn):
        raise DomainError("HSN/SAC must contain 4–8 digits.")
    rate = "" if v.get("gstRate") in [None, ""] else float(number(v["gstRate"], 0, 40))
    return {
        "name": text(v.get("name"), "Product name"),
        "price": money(paise(price)),
        "hsn": hsn,
        "gstRate": rate,
        "unit": text(v.get("unit") or "NOS", "Unit", 12),
        **{
            key: optional(v.get(key), key, size)
            for key, size in [("sku", 60), ("category", 80), ("description", 1000)]
        },
    }


def calculate(items, options):
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise DomainError("Add between 1 and 100 invoice items.")
    gst = options.get("gst", False)
    if not isinstance(gst, bool):
        raise DomainError("GST selection is invalid.")
    supplier, place = options.get("supplierState", ""), options.get("placeOfSupply", "")
    if gst and (supplier not in STATES or place not in STATES):
        raise DomainError("Select supplier state and place of supply.")
    lines = []
    sums = dict.fromkeys(
        ["gross", "discountAmount", "taxable", "cgst", "stateTax", "igst", "total"], 0
    )
    for item in items:
        if not isinstance(item, dict):
            raise DomainError("Invoice item is invalid.")
        price = number(item.get("price"), Decimal("0.01"), 100000000)
        quantity = int(number(item.get("quantity"), 1, 10000, True))
        discount = number(item.get("discount") or 0, 0, 100)
        rate = number(item.get("gstRate"), 0, 40) if gst else Decimal(0)
        gross = paise(price) * quantity
        discount_amount = rounded(Decimal(gross) * discount / 100)
        taxable = gross - discount_amount
        cgst = rounded(Decimal(taxable) * rate / 200) if gst and supplier == place else 0
        igst = rounded(Decimal(taxable) * rate / 100) if gst and supplier != place else 0
        parts = {
            "gross": gross,
            "discountAmount": discount_amount,
            "taxable": taxable,
            "cgst": cgst,
            "stateTax": cgst,
            "igst": igst,
            "total": taxable + 2 * cgst + igst,
        }
        for key, value in parts.items():
            sums[key] += value
        lines.append(
            {
                **item,
                "price": money(paise(price)),
                "quantity": quantity,
                "discount": float(discount),
                "gstRate": float(rate),
                **{
                    ("subTotal" if key == "total" else key): money(value)
                    for key, value in parts.items()
                },
            }
        )
    if any(value > 100000000000000 for value in sums.values()):
        raise DomainError("Invoice amounts cannot exceed INR 1,000,000,000,000.")
    return {
        "lineItems": lines,
        **{key: money(value) for key, value in sums.items()},
        "localTax": "UTGST" if supplier in {"04", "26", "31", "35", "38"} else "SGST",
        "interstate": supplier != place,
    }


def paid(bill):
    reversed_ids = {r["paymentId"] for r in bill.get("reversals", [])}
    return sum(paise(p["amount"]) for p in bill.get("payments", []) if p["_id"] not in reversed_ids)


def require(records, key, revision=None):
    record = (
        records.get(key)
        if isinstance(records, dict)
        else next((r for r in records if r.get("_id", r.get("product")) == key), None)
    )
    if not record:
        raise DomainError("Record is unavailable in this business.")
    if revision is not None and (isinstance(revision, bool) or record.get("revision") != revision):
        raise Conflict("This record changed. Reopen it before trying again.")
    return record


def draft_fields(v, workspace, missing=False, preserve_prices=False, products=None):
    customer = optional(v.get("customer"), "Customer", 100)
    if customer and not missing:
        require(workspace["customers"], customer)
    if not isinstance(v.get("lineItems"), list) or len(v["lineItems"]) > 100:
        raise DomainError("Drafts support up to 100 items.")
    lines = []
    for item in v["lineItems"]:
        if not isinstance(item, dict):
            raise DomainError("Invalid draft item.")
        product = (
            products.get(item.get("product"))
            if products is not None
            else next((p for p in workspace["products"] if p["_id"] == item.get("product")), None)
        )
        if product is None and not missing:
            raise DomainError("A draft product is unavailable.")
        product = product or item
        line = {
            "product": text(item.get("product"), "Product", 100),
            "name": text(item.get("name") if preserve_prices else product.get("name"), "Item name"),
            "price": float(
                number(
                    item.get("price") if preserve_prices else product.get("price"),
                    Decimal("0.01"),
                    100000000,
                )
            ),
            "unit": optional(item.get("unit"), "Unit", 12),
            "hsn": optional(item.get("hsn"), "HSN/SAC", 8),
        }
        for key, low, high, integer in [
            ("quantity", 1, 10000, True),
            ("discount", 0, 100, False),
            ("gstRate", 0, 40, False),
        ]:
            value = item.get(key, "")
            if value not in [None, ""]:
                number(value, low, high, integer)
            line[key] = "" if value is None else str(value)
        lines.append(line)
    result = {
        "title": text(v.get("title") or "Untitled invoice", "Title", 80),
        "customer": customer,
        "lineItems": lines,
        "gst": v.get("gst", False),
    }
    if not isinstance(result["gst"], bool):
        raise DomainError("GST selection is invalid.")
    for key in ["date", "dueDate"]:
        result[key] = valid_date(v[key]) if v.get(key) else ""
    for key, limit in [
        ("supplierGSTIN", 15),
        ("customerGSTIN", 15),
        ("supplierState", 2),
        ("placeOfSupply", 2),
        ("billingAddress", 500),
        ("notes", 1000),
    ]:
        result[key] = optional(v.get(key), key, limit)
    return result


def validate_tax(v, items):
    if v.get("gst"):
        if not gstin(v.get("supplierGSTIN")) or v["supplierGSTIN"][:2] != v.get("supplierState"):
            raise DomainError("Enter a valid supplier GSTIN matching the state.")
        if v.get("customerGSTIN") and not gstin(v["customerGSTIN"]):
            raise DomainError("Customer GSTIN is invalid.")
        if any(not re.fullmatch(r"\d{4,8}", str(i.get("hsn", ""))) for i in items):
            raise DomainError("Enter a 4–8 digit HSN/SAC for each item.")


def settings_fields(v):
    logo = v.get("logo", "")
    if (
        not isinstance(logo, str)
        or len(logo) > 180000
        or (logo and not re.fullmatch(r"data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+", logo))
    ):
        raise DomainError("Use a PNG or JPEG logo under 130 KB.")
    return {
        "name": text(v.get("name"), "Business name"),
        "address": text(v.get("address"), "Address", 500),
        **tax_identity(v),
        "dueDays": int(number(v.get("dueDays"), 0, 365, True)),
        "logo": logo,
        "terms": optional(v.get("terms"), "Terms", 1000),
        "bankDetails": optional(v.get("bankDetails"), "Bank details", 500),
    }
