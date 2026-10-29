"""Import is an explicit, empty-business-only transfer, never a workspace overwrite API."""

import re
from copy import deepcopy

from django.db import transaction

from .limits import preflight
from .models import AuditEvent, Workspace
from .repository import digest, persist, snapshot, workspace_for
from .rules import (
    COLLECTIONS,
    Conflict,
    DomainError,
    calculate,
    customer_fields,
    draft_fields,
    financial_year,
    number,
    paid,
    paise,
    product_fields,
    require,
    settings_fields,
    text,
    valid_date,
    validate_tax,
)


def validate(payload):
    if (
        not isinstance(payload, dict)
        or payload.get("format") != "billflow-workspace"
        or payload.get("version") != 1
    ):
        raise DomainError("Unsupported workspace transfer.")
    raw = payload.get("workspace")
    if not isinstance(raw, dict) or any(
        not isinstance(raw.get(k), list) for k in ["customers", "products", "bills"]
    ):
        raise DomainError("Invalid workspace collections.")
    preflight(raw)
    state = {k: deepcopy(raw.get(k, [])) for k in COLLECTIONS}
    state.update(
        settings=deepcopy(raw.get("settings", {})),
        invoiceSequences=deepcopy(raw.get("invoiceSequences", {})),
        quotationSequence=raw.get("quotationSequence", 0),
    )
    caps = {
        "invoiceDrafts": 200,
        "quotations": 200,
        "invoiceTemplates": 200,
        "stockRecords": 1000,
        "followUps": 500,
    }
    for kind in COLLECTIONS:
        rows = state[kind]
        if not isinstance(rows, list) or len(rows) > caps.get(kind, 10000):
            raise DomainError("Workspace collection limit exceeded.")
        keys = set()
        for row in rows:
            if not isinstance(row, dict):
                raise DomainError("Workspace record is invalid.")
            key = text(
                row.get("product") if kind == "stockRecords" else row.get("_id"), "Record ID", 100
            )
            if key in keys:
                raise DomainError("Workspace contains duplicate record IDs.")
            keys.add(key)
            if kind in [
                "invoiceDrafts",
                "quotations",
                "invoiceTemplates",
                "stockRecords",
                "followUps",
            ]:
                number(row.get("revision"), 1, 9007199254740991, True)
    if state["settings"]:
        settings_fields(state["settings"])
    if not isinstance(state["invoiceSequences"], dict):
        raise DomainError("Invalid document sequences.")
    for key, seq in state["invoiceSequences"].items():
        if not re.fullmatch(r"(?:CN)?\d{4}", key):
            raise DomainError("Invalid document series.")
        number(seq, 0, 999999, True)
    number(state["quotationSequence"], 0, 999999, True)
    for row in state["customers"]:
        customer_fields(row)
    for row in state["products"]:
        product_fields(row)
    indexes = {
        kind: {row.get("_id", row.get("product")): row for row in state[kind]}
        for kind in COLLECTIONS
    }
    issued_drafts = {bill.get("sourceDraftId") for bill in state["bills"]}
    issued_quotes = {
        bill.get("sourceQuotationId"): bill
        for bill in state["bills"]
        if bill.get("sourceQuotationId")
    }
    numbers, sources, credits = set(), set(), set()
    for bill in state["bills"]:
        require(indexes["customers"], bill.get("customer"))
        valid_date(bill.get("date", "")[:10])
        if bill.get("dueDate") and valid_date(bill["dueDate"]) < bill["date"][:10]:
            raise DomainError("Invalid invoice due date.")
        lines = bill.get("lineItems")
        if not isinstance(lines, list):
            raise DomainError("Invalid invoice lines.")
        for line in lines:
            if not isinstance(line, dict):
                raise DomainError("Invalid invoice line.")
            require(indexes["products"], line.get("product"))
        totals = calculate(lines, bill)
        if any(
            paise(bill.get(k, totals[k])) != paise(totals[k])
            for k in ["total", "taxable", "cgst", "stateTax", "igst"]
        ):
            raise DomainError("Invoice totals do not match the saved line items.")
        if bill.get("invoiceNumber"):
            num = bill["invoiceNumber"]
            if (
                not isinstance(num, str)
                or not re.fullmatch(r"BF/\d{4}/\d{6}", num)
                or num in numbers
                or num.split("/")[1] != financial_year(bill["date"][:10])
            ):
                raise DomainError("Invalid or duplicate invoice number.")
            series, seq = num.split("/")[1:]
            if not 1 <= int(seq) <= state["invoiceSequences"].get(series, 0):
                raise DomainError("Invoice sequence would reuse an issued number.")
            numbers.add(num)
            supplier, customer = bill.get("supplierSnapshot"), bill.get("customerSnapshot")
            if (
                not isinstance(supplier, dict)
                or not isinstance(customer, dict)
                or customer.get("_id") != bill["customer"]
            ):
                raise DomainError("Issued invoice party snapshots are missing.")
            validate_tax(
                {
                    **bill,
                    "supplierGSTIN": supplier.get("gstin"),
                    "customerGSTIN": customer.get("gstin"),
                },
                lines,
            )
        payments, reversals = bill.get("payments", []), bill.get("reversals", [])
        if not isinstance(payments, list) or not isinstance(reversals, list):
            raise DomainError("Invalid payment history.")
        ids, reversed_ids = set(), set()
        for payment in payments:
            if not isinstance(payment, dict) or payment.get("_id") in ids:
                raise DomainError("Duplicate or invalid payment record.")
            ids.add(text(payment.get("_id"), "Payment ID", 100))
            if (
                paise(payment.get("amount")) <= 0
                or valid_date(payment.get("date")) < bill["date"][:10]
                or payment.get("method") not in ["UPI", "Bank transfer", "Cash", "Card", "Cheque"]
            ):
                raise DomainError("Invalid payment record.")
        payment_index = {payment["_id"]: payment for payment in payments}
        for reversal in reversals:
            if (
                not isinstance(reversal, dict)
                or reversal.get("paymentId") not in ids
                or reversal["paymentId"] in reversed_ids
            ):
                raise DomainError("Invalid payment reversal history.")
            payment = require(payment_index, reversal["paymentId"])
            if paise(reversal.get("amount")) != paise(payment["amount"]):
                raise DomainError("Payment reversal amount differs.")
            text(reversal.get("reason"), "Reversal reason", 500)
            reversed_ids.add(reversal["paymentId"])
        if paid(bill) > paise(bill["total"]) or (
            paid(bill) and (bill.get("creditNote") or bill.get("cancellation"))
        ):
            raise DomainError("Payment history exceeds the outstanding invoice.")
        if bill.get("creditNote") and bill.get("cancellation"):
            raise DomainError("Invoice has contradictory corrections.")
        for field in ["creditNote", "cancellation"]:
            if not bill.get(field):
                continue
            event = bill[field]
            if not isinstance(event, dict):
                raise DomainError("Invalid correction history.")
            text(event.get("reason"), "Correction reason", 500)
            valid_date(event.get("date"))
            if field == "creditNote":
                num = event.get("number", "")
                if (
                    not re.fullmatch(r"CN/\d{4}/\d{6}", num)
                    or num in credits
                    or paise(event.get("amount")) != paise(bill["total"])
                ):
                    raise DomainError("Invalid credit note.")
                if (
                    not 1
                    <= int(num[-6:])
                    <= state["invoiceSequences"].get("CN" + num.split("/")[1], 0)
                ):
                    raise DomainError("Credit note sequence would be reused.")
                credits.add(num)
        for source in ["sourceDraftId", "sourceQuotationId"]:
            if bill.get(source):
                key = (source, text(bill[source], "Source ID", 100))
                if key in sources:
                    raise DomainError("A source document was issued twice.")
                sources.add(key)
    for row in state["invoiceDrafts"]:
        draft_fields(row, state, missing=True, products=indexes["products"])
        if row["_id"] in issued_drafts:
            raise DomainError("An issued draft is still active.")
    quote_numbers = set()
    for quote in state["quotations"]:
        record = draft_fields(
            quote, state, missing=True, preserve_prices=True, products=indexes["products"]
        )
        validate_tax(record, record["lineItems"])
        calculate(record["lineItems"], record)
        if (
            not record["customer"]
            or not record["billingAddress"]
            or not record["date"]
            or not record["dueDate"]
            or record["dueDate"] < record["date"]
        ):
            raise DomainError("Invalid quotation dates or customer.")
        num = quote.get("number", "")
        if (
            not re.fullmatch(r"QT/\d{4}/\d{6}", num)
            or num in quote_numbers
            or not 1 <= int(num[-6:]) <= state["quotationSequence"]
            or quote.get("status") not in ["open", "accepted", "rejected", "converted"]
        ):
            raise DomainError("Invalid quotation history.")
        quote_numbers.add(num)
        for field in ["supplierSnapshot", "customerSnapshot"]:
            party = quote.get(field)
            if not isinstance(party, dict):
                raise DomainError("Quotation party snapshots are missing.")
            text(party.get("name"), "Party name")
            text(party.get("address"), "Party address", 500)
        if quote["customerSnapshot"].get("_id") != quote["customer"]:
            raise DomainError("Quotation customer snapshot does not match.")
        linked = issued_quotes.get(quote["_id"])
        if (quote["status"] == "converted") != bool(linked) or (
            linked and linked["_id"] != quote.get("invoiceId")
        ):
            raise DomainError("Quotation conversion link does not match.")
    for bill in state["bills"]:
        if bill.get("sourceQuotationId"):
            require(indexes["quotations"], bill["sourceQuotationId"])
    for template in state["invoiceTemplates"]:
        record = draft_fields(
            {k: template.get(k) for k in ["title", "lineItems", "notes"]},
            state,
            missing=True,
            products=indexes["products"],
        )
        calculate(record["lineItems"], {})
    for record in state["stockRecords"]:
        require(indexes["products"], record["product"])
        text(record.get("unit"), "Stock unit", 12)
        movements = record.get("movements")
        if (
            not isinstance(movements, list)
            or not 1 <= len(movements) <= 200
            or len(movements) != record["revision"]
        ):
            raise DomainError("Invalid stock history.")
        balance = 0
        for i, move in enumerate(movements):
            if not isinstance(move, dict) or move.get("type") not in (
                ["opening"] if i == 0 else ["adjustment", "threshold"]
            ):
                raise DomainError("Invalid stock movement.")
            delta = int(number(move.get("delta"), -1000000, 1000000, True))
            balance += delta
            number(balance, 0, 1000000, True)
            number(move.get("reorderLevel"), 0, 1000000, True)
            if balance != move.get("balance") or (move["type"] == "threshold" and delta != 0):
                raise DomainError("Stock balance does not match its history.")
            text(move.get("reason"), "Movement reason", 500)
        if (
            record.get("onHand") != balance
            or record.get("reorderLevel") != movements[-1]["reorderLevel"]
        ):
            raise DomainError("Stock history does not match current balance.")
    for task in state["followUps"]:
        text(task.get("customer"), "Customer ID", 100)
        text(task.get("customerName"), "Customer name")
        text(task.get("title"), "Task title", 80)
        valid_date(task.get("dueDate"))
        history = task.get("history")
        if (
            task.get("status") not in ["open", "completed"]
            or not isinstance(history, list)
            or not 1 <= len(history) <= 100
            or len(history) != task["revision"]
        ):
            raise DomainError("Invalid follow-up history.")
        for event in history:
            if not isinstance(event, dict) or event.get("action") not in [
                "created",
                "updated",
                "completed",
                "reopened",
            ]:
                raise DomainError("Invalid follow-up event.")
            if event["action"] in ["completed", "reopened"]:
                text(event.get("outcome"), "Outcome", 500)
            else:
                valid_date(event.get("dueDate"))
        if (history[-1]["action"] == "completed") != (task["status"] == "completed"):
            raise DomainError("Follow-up status differs from history.")
    return state


def preview(user, payload):
    state = validate(payload)
    workspace = workspace_for(user)
    return {
        "digest": digest(state),
        "revision": workspace.revision,
        "counts": {k: len(state[k]) for k in COLLECTIONS},
        "canImport": empty(snapshot(workspace)),
    }


def empty(state):
    return (
        not any(state[k] for k in COLLECTIONS)
        and not state["invoiceSequences"]
        and not state["quotationSequence"]
    )


def commit(user, values):
    if values.get("confirmation") != "IMPORT":
        raise DomainError("Type IMPORT to confirm the transfer.")
    state = validate(values.get("payload"))
    if digest(state) != values.get("digest"):
        raise Conflict("The backup changed after preview. Preview it again.")
    workspace = workspace_for(user)
    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
        # Lost-response retries are safe only for this exact successful transfer.
        previous = AuditEvent.objects.filter(
            workspace=workspace, action="import:" + digest(state)[:32]
        ).first()
        if previous:
            return {"imported": True, "revision": previous.revision}
        before = snapshot(workspace)
        if values.get("revision") != workspace.revision or not empty(before):
            raise Conflict(
                "Import requires an unchanged empty business. Existing records are never merged or replaced."
            )
        persist(workspace, before, state)
        AuditEvent.objects.create(
            workspace=workspace,
            actor=user,
            action="import:" + digest(state)[:32],
            revision=workspace.revision,
        )
        return {"imported": True, "revision": workspace.revision}
