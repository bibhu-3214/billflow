"""Commands operate on a private snapshot under the database workspace lock."""

from copy import deepcopy

from .rules import (
    Conflict,
    DomainError,
    calculate,
    customer_fields,
    draft_fields,
    financial_year,
    money,
    now,
    number,
    optional,
    paid,
    paise,
    product_fields,
    require,
    settings_fields,
    text,
    today,
    uid,
    valid_date,
    validate_tax,
)


class Operations:
    def __init__(self, state, user):
        self.s = state
        self.user = user

    def profile(self):
        return {
            "name": self.user.business_name or "Your business",
            "address": self.user.business_address,
            "gstin": "",
            "state": "",
            "terms": "",
            "dueDays": 0,
            "bankDetails": "",
            "logo": "",
            **self.s["settings"],
        }

    def supplier_profile(self):
        profile = self.profile()
        if (
            not (self.s["settings"].get("name") or self.user.business_name)
            or not profile["address"]
        ):
            raise DomainError(
                "Complete the business name and address in Settings before issuing documents."
            )
        text(profile["name"], "Business name")
        text(profile["address"], "Business address", 500)
        return profile

    def customer(self, values, key=None):
        old = require(self.s["customers"], key) if key else {}
        record = {**customer_fields({**old, **values}), "_id": key or uid("customer")}
        self.put("customers", record)
        return record

    def product(self, values, key=None):
        old = require(self.s["products"], key) if key else {}
        record = {**product_fields({**old, **values}), "_id": key or uid("product")}
        self.put("products", record)
        return record

    def put(self, kind, record):
        key = record.get("_id", record.get("product"))
        rows = self.s[kind]
        for i, row in enumerate(rows):
            if row.get("_id", row.get("product")) == key:
                rows[i] = record
                return
        if len(rows) >= 10000:
            raise DomainError("Workspace record limit reached. Contact support.")
        rows.append(record)

    def remove(self, kind, key):
        record = require(self.s[kind], key)
        self.s[kind].remove(record)
        return record

    def remove_customer(self, key):
        if any(b["customer"] == key for b in self.s["bills"]):
            raise DomainError("This customer is referenced by an invoice and cannot be deleted.")
        return self.remove("customers", key)

    def remove_product(self, key):
        if any(r["product"] == key for r in self.s["stockRecords"]) or any(
            i["product"] == key for b in self.s["bills"] for i in b["lineItems"]
        ):
            raise DomainError("This product has invoice or stock history and cannot be deleted.")
        return self.remove("products", key)

    def save_draft(self, values, key=None, revision=None):
        old = require(self.s["invoiceDrafts"], key, revision) if key else {}
        if key and revision is None:
            raise Conflict("A draft revision is required.")
        if not old and len(self.s["invoiceDrafts"]) >= 200:
            raise DomainError("The workspace supports 200 drafts.")
        record = {
            **draft_fields(values, self.s),
            "_id": key or uid("draft"),
            "revision": old.get("revision", 0) + 1,
            "createdAt": old.get("createdAt", now()),
            "updatedAt": now(),
        }
        self.put("invoiceDrafts", record)
        return record

    def duplicate_draft(self, key, revision):
        source = require(self.s["invoiceDrafts"], key, revision)
        values = {
            **source,
            "title": (source["title"] + " (copy)")[:80],
            "date": today(),
            "dueDate": "",
        }
        # Missing references are retained for repair, matching the browser workflow.
        if len(self.s["invoiceDrafts"]) >= 200:
            raise DomainError("The workspace supports 200 drafts.")
        record = {
            **draft_fields(values, self.s, missing=True),
            "_id": uid("draft"),
            "revision": 1,
            "createdAt": now(),
            "updatedAt": now(),
        }
        self.s["invoiceDrafts"].append(record)
        return record

    def remove_draft(self, key, revision):
        require(self.s["invoiceDrafts"], key, revision)
        return self.remove("invoiceDrafts", key)

    def quotation(self, values):
        if len(self.s["quotations"]) >= 200 or self.s["quotationSequence"] >= 999999:
            raise DomainError("Quotation limit reached.")
        record = draft_fields(values, self.s)
        if (
            not record["customer"]
            or not record["billingAddress"]
            or not record["date"]
            or not record["dueDate"]
            or record["dueDate"] < record["date"]
        ):
            raise DomainError("Choose a customer, address and valid quotation dates.")
        validate_tax(record, record["lineItems"])
        calculate(record["lineItems"], record)
        self.s["quotationSequence"] += 1
        quote = {
            **record,
            "_id": uid("quote"),
            "number": f"QT/{financial_year(record['date'])}/{self.s['quotationSequence']:06d}",
            "revision": 1,
            "status": "open",
            "createdAt": now(),
            "supplierSnapshot": {**self.supplier_profile(), "gstin": record["supplierGSTIN"]},
            "customerSnapshot": {
                **require(self.s["customers"], record["customer"]),
                "address": record["billingAddress"],
                "gstin": record["customerGSTIN"],
            },
        }
        self.s["quotations"].append(quote)
        return quote

    def quote_status(self, key, revision, status):
        quote = require(self.s["quotations"], key, revision)
        if (
            quote["status"] != "open"
            or quote["dueDate"] < today()
            or status not in ["accepted", "rejected"]
        ):
            raise DomainError("Only open, unexpired quotations can be accepted or rejected.")
        quote.update(status=status, revision=quote["revision"] + 1, decidedAt=now())
        return quote

    def template(self, values):
        if len(self.s["invoiceTemplates"]) >= 200:
            raise DomainError("The workspace supports 200 templates.")
        fields = draft_fields(
            {
                "title": values.get("title"),
                "lineItems": values.get("lineItems"),
                "notes": values.get("notes"),
            },
            self.s,
        )
        calculate(fields["lineItems"], {})
        record = {key: fields[key] for key in ["title", "lineItems", "notes"]}
        record.update(_id=uid("template"), revision=1)
        self.s["invoiceTemplates"].append(record)
        return record

    def template_draft(self, key):
        template = require(self.s["invoiceTemplates"], key)
        settings = self.profile()
        return self.save_draft(
            {
                **template,
                "date": today(),
                "dueDate": "",
                "gst": bool(settings["gstin"]),
                "supplierGSTIN": settings["gstin"],
                "supplierState": settings["state"],
            }
        )

    def invoice(self, values):
        v = deepcopy(values)
        quote = None
        for field, source in [("quotationId", "sourceQuotationId"), ("draftId", "sourceDraftId")]:
            if v.get(field):
                issued = next((b for b in self.s["bills"] if b.get(source) == v[field]), None)
                if issued:
                    return issued
        if v.get("quotationId"):
            quote = require(self.s["quotations"], v["quotationId"], v.get("quotationRevision"))
            if quote["status"] != "accepted" or quote["dueDate"] < today():
                raise DomainError("Only accepted, unexpired quotations can be converted.")
            date = valid_date(v.get("date"))
            if not quote["date"] <= date <= quote["dueDate"]:
                raise DomainError("Invoice date must be within quotation validity.")
            v = {**quote, "date": date, "dueDate": v.get("dueDate"), "quotationId": quote["_id"]}
        if v.get("draftId"):
            if v.get("draftRevision") is None:
                raise Conflict("A draft revision is required.")
            require(self.s["invoiceDrafts"], v["draftId"], v["draftRevision"])
        date = valid_date(v.get("date"))
        fy = financial_year(date)
        due = valid_date(v.get("dueDate") or date)
        if due < date:
            raise DomainError("Due date must be on or after the invoice date.")
        customer = require(self.s["customers"], v.get("customer"))
        address = text(v.get("billingAddress"), "Billing address", 500)
        if not isinstance(v.get("lineItems"), list) or not 1 <= len(v["lineItems"]) <= 100:
            raise DomainError("Add between 1 and 100 invoice items.")
        lines = []
        for item in v["lineItems"]:
            if not isinstance(item, dict):
                raise DomainError("Invalid invoice item.")
            product = require(self.s["products"], item.get("product"))
            price = item["price"] if quote else product["price"]
            if (
                not quote
                and item.get("price") is not None
                and number(item["price"]) != number(price)
            ):
                raise Conflict(
                    "A catalog price changed. Save a draft and reopen it to review current prices."
                )
            lines.append(
                {
                    "_id": uid("item"),
                    "product": product["_id"],
                    "name": item["name"] if quote else product["name"],
                    "price": price,
                    "quantity": item.get("quantity"),
                    "discount": item.get("discount", 0),
                    "gstRate": item.get("gstRate"),
                    "hsn": optional(item.get("hsn"), "HSN/SAC", 8),
                    "unit": text(item.get("unit") or "NOS", "Unit", 12),
                }
            )
        validate_tax(v, lines)
        totals = calculate(lines, v)
        seq = self.next_sequence(fy)
        bill = {
            **totals,
            "_id": uid("invoice"),
            "invoiceNumber": f"BF/{fy}/{seq:06d}",
            "date": date,
            "dueDate": due,
            "gst": v.get("gst", False),
            "supplierState": v.get("supplierState", ""),
            "placeOfSupply": v.get("placeOfSupply", ""),
            "supplierSnapshot": deepcopy(
                quote["supplierSnapshot"]
                if quote
                else {
                    **self.supplier_profile(),
                    "gstin": v.get("supplierGSTIN", "") if v.get("gst") else "",
                }
            ),
            "customerSnapshot": deepcopy(
                quote["customerSnapshot"]
                if quote
                else {
                    **customer,
                    "address": address,
                    "gstin": v.get("customerGSTIN", "") if v.get("gst") else "",
                }
            ),
            "notes": optional(v.get("notes"), "Notes", 1000),
            "payments": [],
            "customer": customer["_id"],
            "createdAt": now(),
        }
        if quote:
            bill.update(sourceQuotationId=quote["_id"], sourceQuotationNumber=quote["number"])
            quote.update(status="converted", invoiceId=bill["_id"], revision=quote["revision"] + 1)
        if v.get("draftId"):
            bill["sourceDraftId"] = v["draftId"]
            self.remove("invoiceDrafts", v["draftId"])
        self.put("bills", bill)
        return bill

    def next_sequence(self, key):
        seq = self.s["invoiceSequences"].get(key, 0) + 1
        if seq > 999999:
            raise DomainError("Document series is exhausted.")
        self.s["invoiceSequences"][key] = seq
        return seq

    def payment(self, key, v):
        bill = require(self.s["bills"], key)
        if bill.get("cancellation") or bill.get("creditNote"):
            raise DomainError("This invoice is closed.")
        amount = paise(v.get("amount"))
        if amount <= 0 or amount > paise(bill["total"]) - paid(bill):
            raise DomainError("Payment must be positive and cannot exceed the balance.")
        date = valid_date(v.get("date"))
        if not bill["date"][:10] <= date <= today():
            raise DomainError("Payment date must be between invoice date and today.")
        if v.get("method") not in ["UPI", "Bank transfer", "Cash", "Card", "Cheque"]:
            raise DomainError("Choose a valid payment method.")
        if len(bill.get("payments", [])) >= 1000:
            raise DomainError("Invoice payment history limit reached.")
        bill.setdefault("payments", []).append(
            {
                "_id": uid("payment"),
                "amount": money(amount),
                "date": date,
                "method": v["method"],
                "reference": optional(v.get("reference"), "Reference", 120),
                "createdAt": now(),
            }
        )
        return bill

    def correction(self, key, v):
        bill = require(self.s["bills"], key)
        event = {
            "_id": uid("event"),
            "reason": text(v.get("reason"), "Correction reason", 500),
            "date": today(),
            "createdAt": now(),
            "actor": self.user.display_name or self.user.email,
        }
        if v.get("action") == "reverse":
            payment = require(bill.get("payments", []), v.get("paymentId"))
            if any(r["paymentId"] == payment["_id"] for r in bill.get("reversals", [])):
                raise DomainError("Payment is already reversed.")
            bill.setdefault("reversals", []).append(
                {**event, "paymentId": payment["_id"], "amount": payment["amount"]}
            )
        else:
            if (
                bill.get("cancellation")
                or bill.get("creditNote")
                or paid(bill) > 0
                or bill["date"][:10] > today()
            ):
                raise DomainError(
                    "Invoice is closed, future-dated or has active payments. Handle refunds outside BillFlow first."
                )
            if v.get("action") == "cancel":
                bill["cancellation"] = event
            elif v.get("action") == "credit" and bill.get("invoiceNumber"):
                fy = financial_year(today())
                seq = self.next_sequence("CN" + fy)
                bill["creditNote"] = {
                    **event,
                    "number": f"CN/{fy}/{seq:06d}",
                    "amount": bill["total"],
                    **{key: bill.get(key, 0) for key in ["taxable", "cgst", "stateTax", "igst"]},
                }
            else:
                raise DomainError("Invalid correction action.")
        return bill

    def remove_invoice(self, key):
        bill = require(self.s["bills"], key)
        if any(
            bill.get(f)
            for f in ["invoiceNumber", "payments", "cancellation", "creditNote", "reversals"]
        ):
            raise DomainError("Issued invoices and payment records cannot be deleted.")
        return self.remove("bills", key)

    def stock(self, v):
        product = require(self.s["products"], v.get("product"))
        old = next((r for r in self.s["stockRecords"] if r["product"] == product["_id"]), None)
        if v.get("revision") != (old["revision"] if old else 0):
            raise Conflict("Stock changed. Close and reopen to refresh.")
        if old and old["unit"] != product.get("unit", "NOS"):
            raise DomainError("Restore the tracked catalog unit before adjusting stock.")
        if (old and len(old["movements"]) >= 200) or (
            not old and len(self.s["stockRecords"]) >= 1000
        ):
            raise DomainError("Stock history limit reached; no history was removed.")
        kind = v.get("type")
        delta = int(number(v.get("delta"), -1000000, 1000000, True))
        threshold = int(number(v.get("reorderLevel"), 0, 1000000, True))
        if (
            (not old and (kind != "opening" or delta < 0))
            or (old and kind not in ["adjustment", "threshold"])
            or (kind == "adjustment" and delta == 0)
            or (kind == "threshold" and delta != 0)
        ):
            raise DomainError("Enter a valid whole-unit stock movement.")
        balance = (old["onHand"] if old else 0) + delta
        number(balance, 0, 1000000, True)
        movement = {
            "type": kind,
            "delta": delta,
            "balance": balance,
            "reorderLevel": threshold,
            "reason": text(v.get("reason"), "Adjustment reason", 500),
            "at": now(),
        }
        record = {
            "product": product["_id"],
            "name": product["name"],
            "unit": product.get("unit", "NOS"),
            "onHand": balance,
            "reorderLevel": threshold,
            "revision": (old["revision"] if old else 0) + 1,
            "movements": [*(old["movements"] if old else []), movement],
        }
        self.put("stockRecords", record)
        return record

    def followup(self, v, key=None, revision=None):
        old = require(self.s["followUps"], key, revision) if key else None
        if old and (old["status"] == "completed" or len(old["history"]) >= 100):
            raise DomainError("Reopen the task before editing, or its history limit was reached.")
        if not old and len(self.s["followUps"]) >= 500:
            raise DomainError("The workspace supports 500 follow-ups.")
        customer = require(self.s["customers"], v.get("customer"))
        if (
            v.get("channel") not in ["Phone", "WhatsApp", "Email", "In person"]
            or v.get("purpose") not in ["Collection", "Order enquiry", "Account review"]
            or v.get("priority") not in ["Normal", "High"]
        ):
            raise DomainError("Choose valid follow-up details.")
        record = {key: v[key] for key in ["customer", "channel", "purpose", "priority"]}
        record.update(
            _id=key or uid("followup"),
            title=text(v.get("title"), "Title", 80),
            dueDate=valid_date(v.get("dueDate")),
            notes=optional(v.get("notes"), "Notes", 1000),
            customerName=customer["name"],
            status="open",
            revision=(old["revision"] if old else 0) + 1,
            createdAt=old["createdAt"] if old else now(),
            updatedAt=now(),
            history=[
                *(old["history"] if old else []),
                {"action": "updated" if old else "created", "at": now(), "dueDate": v["dueDate"]},
            ],
        )
        self.put("followUps", record)
        return record

    def followup_status(self, key, revision, status, outcome):
        record = require(self.s["followUps"], key, revision)
        if (
            status not in ["open", "completed"]
            or record["status"] == status
            or len(record["history"]) >= 100
        ):
            raise DomainError("Choose a different status, or history limit reached.")
        record.update(status=status, revision=record["revision"] + 1, updatedAt=now())
        record["history"].append(
            {
                "action": "completed" if status == "completed" else "reopened",
                "at": now(),
                "outcome": text(outcome, "Outcome / reason", 500),
            }
        )
        return record

    def save_settings(self, values):
        self.s["settings"] = settings_fields(values)
        return self.s["settings"]

    def dispatch(self, action, args):
        actions = {
            "addCustomer": (self.customer, 1),
            "editCustomer": (lambda key, v: self.customer(v, key), 2),
            "removeCustomer": (self.remove_customer, 1),
            "addProduct": (self.product, 1),
            "editProduct": (lambda key, v: self.product(v, key), 2),
            "removeProduct": (self.remove_product, 1),
            "saveSettings": (self.save_settings, 1),
            "recordStockMovement": (self.stock, 1),
            "saveFollowUp": (self.followup, 3),
            "setFollowUpStatus": (self.followup_status, 4),
            "saveInvoiceDraft": (self.save_draft, 3),
            "duplicateInvoiceDraft": (self.duplicate_draft, 2),
            "removeInvoiceDraft": (self.remove_draft, 2),
            "saveQuotation": (self.quotation, 1),
            "setQuotationStatus": (self.quote_status, 3),
            "saveInvoiceTemplate": (self.template, 1),
            "removeInvoiceTemplate": (lambda key: self.remove("invoiceTemplates", key), 1),
            "draftFromTemplate": (self.template_draft, 1),
            "addBill": (self.invoice, 1),
            "recordPayment": (self.payment, 2),
            "correctInvoice": (self.correction, 2),
            "removeBill": (self.remove_invoice, 1),
        }
        if action not in actions or not isinstance(args, list):
            raise DomainError("Unsupported command.")
        handler, arity = actions[action]
        if len(args) != arity:
            raise DomainError("Invalid command arguments.")
        # Updated records must always include an expected revision.
        if action in ["saveInvoiceDraft", "saveFollowUp"] and args[1] and args[2] is None:
            raise Conflict("A record revision is required.")
        if (
            action
            in [
                "setFollowUpStatus",
                "duplicateInvoiceDraft",
                "removeInvoiceDraft",
                "setQuotationStatus",
            ]
            and args[1] is None
        ):
            raise Conflict("A record revision is required.")
        if action in [
            "addBill",
            "saveQuotation",
            "addCustomer",
            "addProduct",
            "saveInvoiceTemplate",
            "recordStockMovement",
            "saveSettings",
            "saveFollowUp",
            "saveInvoiceDraft",
        ] and not isinstance(args[0], dict):
            raise DomainError("Command values must be an object.")
        if action in [
            "editCustomer",
            "editProduct",
            "recordPayment",
            "correctInvoice",
        ] and not isinstance(args[1], dict):
            raise DomainError("Command values must be an object.")
        if (
            action == "addBill"
            and args[0].get("quotationId")
            and args[0].get("quotationRevision") is None
        ):
            raise Conflict("A quotation revision is required.")
        return handler(*args)
