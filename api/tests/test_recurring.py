import uuid
from copy import deepcopy

import pytest

from billing.imports import validate
from billing.recurring import next_review_date
from billing.repository import execute, snapshot, workspace_for
from billing.rules import Conflict, DomainError, today

pytestmark = pytest.mark.django_db


def command(user, action, *args, key=None):
    return execute(user, action, list(args), key or uuid.uuid4())


def seed_plan(user):
    customer = command(
        user,
        "addCustomer",
        {"name": "Recurring buyer", "mobile": "9876543210", "email": "buyer@example.test"},
    )
    product = command(user, "addProduct", {"name": "Retainer", "price": 100, "unit": "NOS"})
    invoice = command(
        user,
        "addBill",
        {
            "customer": customer["_id"],
            "date": today(),
            "dueDate": today(),
            "billingAddress": "Mumbai",
            "lineItems": [{"product": product["_id"], "quantity": 2}],
        },
    )
    plan = command(
        user,
        "saveFollowUp",
        {
            "customer": customer["_id"],
            "title": "Monthly retainer",
            "dueDate": today(),
            "channel": "In person",
            "priority": "Normal",
            "purpose": "Account review",
            "recurrence": {"invoiceId": invoice["_id"], "cadence": "monthly", "anchorDay": 31},
        },
        None,
        None,
    )
    return customer, product, invoice, plan


def test_prepare_is_atomic_uses_current_prices_and_does_not_issue_an_invoice(user):
    _, product, invoice, plan = seed_plan(user)
    command(user, "editProduct", product["_id"], {**product, "price": 150})
    identity = uuid.uuid4()
    draft = command(user, "prepareRecurringInvoice", plan["_id"], plan["revision"], key=identity)
    assert draft["lineItems"][0]["price"] == 150
    assert draft["date"] == today()
    state = snapshot(workspace_for(user))
    assert len(state["bills"]) == 1 and state["bills"][0]["_id"] == invoice["_id"]
    assert len(state["invoiceDrafts"]) == 1
    assert state["followUps"][0]["dueDate"] > today()
    assert (
        command(user, "prepareRecurringInvoice", plan["_id"], plan["revision"], key=identity)
        == draft
    )
    with pytest.raises(Conflict):
        command(user, "prepareRecurringInvoice", plan["_id"], plan["revision"])
    with pytest.raises(DomainError):
        command(user, "prepareRecurringInvoice", plan["_id"], plan["revision"] + 1)
    validate({"format": "billflow-workspace", "version": 1, "workspace": state})


def test_paused_or_cancelled_sources_cannot_prepare_and_state_is_preserved(user):
    _, _, invoice, plan = seed_plan(user)
    command(user, "setFollowUpStatus", plan["_id"], plan["revision"], "completed", "Paused")
    before = deepcopy(snapshot(workspace_for(user)))
    with pytest.raises(DomainError):
        command(user, "prepareRecurringInvoice", plan["_id"], 2)
    assert snapshot(workspace_for(user)) == before
    command(user, "setFollowUpStatus", plan["_id"], 2, "open", "Resumed")
    command(
        user,
        "correctInvoice",
        invoice["_id"],
        {"action": "cancel", "reason": "Recurring service cancelled"},
    )
    before = deepcopy(snapshot(workspace_for(user)))
    with pytest.raises(DomainError):
        command(user, "prepareRecurringInvoice", plan["_id"], 3)
    assert snapshot(workspace_for(user)) == before


def test_month_end_and_long_overdue_plans_advance_without_drift():
    assert next_review_date("2026-01-31", "monthly", 31, "2026-01-31") == "2026-02-28"
    assert next_review_date("2026-02-28", "monthly", 31, "2026-02-28") == "2026-03-31"
    assert next_review_date("2028-01-31", "monthly", 31, "2028-01-31") == "2028-02-29"
    assert next_review_date("2020-01-31", "monthly", 31, "2026-10-31") == "2026-11-30"
