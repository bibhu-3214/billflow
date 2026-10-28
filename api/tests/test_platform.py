import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
from urllib.parse import unquote

import pytest
from allauth.account.models import EmailAddress
from django.core import management
from django.db import close_old_connections, connections
from django.test import Client
from django.utils import timezone

from accounts.models import User
from billing.imports import commit, preview
from billing.models import AuditEvent, Invoice, Record
from billing.repository import execute, snapshot, workspace_for
from billing.rules import Conflict, DomainError, calculate, financial_year, today
from mail.models import Delivery

pytestmark = pytest.mark.django_db


def command(user, action, *args, key=None):
    return execute(user, action, list(args), key or uuid.uuid4())


def seed(user):
    customer = command(
        user,
        "addCustomer",
        {"name": "Buyer", "mobile": "9876543210", "email": "buyer@example.test"},
    )
    product = command(
        user, "addProduct", {"name": "Service", "price": 100, "gstRate": 18, "hsn": "9983"}
    )
    values = {
        "date": today(),
        "customer": customer["_id"],
        "billingAddress": "Mumbai",
        "lineItems": [{"product": product["_id"], "quantity": 2}],
    }
    return customer, product, values


def csrf_client():
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/v1/config").json()["csrfToken"]
    client.defaults["HTTP_X_CSRFTOKEN"] = token
    return client


def test_authentication_csrf_verification_and_no_secret_export(user):
    client = csrf_client()
    denied = client.post(
        "/api/v1/actions/addCustomer", {"args": []}, content_type="application/json"
    )
    assert denied.status_code in [401, 403]
    client.force_login(user)
    client.defaults.clear()
    assert (
        client.post("/api/v1/actions/addCustomer", {}, content_type="application/json").status_code
        == 403
    )
    response = client.get("/api/v1/workspace")
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert "password" not in response.content.decode()
    EmailAddress.objects.filter(user=user).update(verified=False)
    assert client.get("/api/v1/workspace").status_code == 403


def test_signup_stores_profile_and_requires_real_verification():
    client = csrf_client()
    values = {
        "email": "new@example.test",
        "password": "UnusualPrivate#4827",
        "username": "New owner",
        "businessName": "New business",
        "address": "Pune",
    }
    response = client.post(
        "/_allauth/browser/v1/auth/signup", values, content_type="application/json"
    )
    assert response.status_code == 401, response.content
    user = User.objects.get(email=values["email"])
    assert user.business_name == "New business"
    assert client.get("/api/v1/me").status_code in [401, 403]
    mail = Delivery.objects.get(recipient=values["email"])
    key = unquote(re.search(r"verify=([^\s<>]+)", mail.body).group(1))
    response = client.post(
        "/_allauth/browser/v1/auth/email/verify", {"key": key}, content_type="application/json"
    )
    assert response.status_code in [200, 401], response.content
    assert EmailAddress.objects.get(user=user).verified


def test_recovery_is_non_enumerating_and_revokes_sessions(user):
    old = csrf_client()
    old.force_login(user)
    client = csrf_client()
    known = client.post(
        "/_allauth/browser/v1/auth/password/request",
        {"email": user.email},
        content_type="application/json",
    )
    unknown = client.post(
        "/_allauth/browser/v1/auth/password/request",
        {"email": "missing@example.test"},
        content_type="application/json",
    )
    assert known.status_code == unknown.status_code
    message = Delivery.objects.get(recipient=user.email)
    key = unquote(re.search(r"resetKey=([^\s<>]+)", message.body).group(1))
    response = client.post(
        "/_allauth/browser/v1/auth/password/reset",
        {"key": key, "password": "NewPrivatePass#4828"},
        content_type="application/json",
    )
    assert response.status_code in [200, 401], response.content
    user.refresh_from_db()
    assert user.check_password("NewPrivatePass#4828")
    assert old.get("/api/v1/me").status_code in [401, 403]


def test_mobile_session_is_revoked_on_logout(user):
    client = Client()
    response = client.post(
        "/_allauth/app/v1/auth/login",
        {"email": user.email, "password": "PrivatePassword#2581"},
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    token = response.json()["meta"]["session_token"]
    native = Client(HTTP_X_SESSION_TOKEN=token)
    assert native.get("/api/v1/workspace").status_code == 200
    assert native.delete("/_allauth/app/v1/auth/session").status_code in [200, 401]
    assert native.get("/api/v1/workspace").status_code == 401


def test_owner_scoping_and_idempotency(user, api):
    _, _, values = seed(user)
    key = uuid.uuid4()
    first = command(user, "addBill", values, key=key)
    assert command(user, "addBill", values, key=key) == first
    assert Invoice.objects.count() == 1
    with pytest.raises(Conflict):
        command(user, "addBill", {**values, "notes": "Different"}, key=key)
    other = User.objects.create_user("other@example.test", "OtherPrivate#4828")
    with pytest.raises(DomainError):
        command(
            other, "recordPayment", first["_id"], {"amount": 1, "date": today(), "method": "Cash"}
        )
    assert snapshot(workspace_for(other))["bills"] == []
    response = api.post("/api/v1/actions/getBill", {"args": ["missing"]}, format="json")
    assert response.status_code == 400
    assert api.post("/api/v1/actions/addBill", {"args": [values]}, format="json").status_code == 400


@pytest.mark.parametrize(
    "items,options,total",
    [
        ([{"price": 100, "quantity": 2}], {}, 200),
        (
            [{"price": 100, "quantity": 2, "discount": 10, "gstRate": 18}],
            {"gst": True, "supplierState": "27", "placeOfSupply": "27"},
            212.4,
        ),
        (
            [{"price": 0.05, "quantity": 1, "gstRate": 18}],
            {"gst": True, "supplierState": "27", "placeOfSupply": "29"},
            0.06,
        ),
        (
            [{"price": 0.05, "quantity": 1, "gstRate": 18}],
            {"gst": True, "supplierState": "27", "placeOfSupply": "27"},
            0.05,
        ),
    ],
)
def test_decimal_tax_rounding(items, options, total):
    assert calculate(items, options)["total"] == total


@pytest.mark.parametrize("value", [True, None, "NaN", "Infinity", -1, 0, 100000001])
def test_product_price_validation(user, value):
    with pytest.raises(DomainError):
        command(user, "addProduct", {"name": "Invalid", "price": value})
    assert Record.objects.count() == 0


def test_draft_atomic_issue_retry_and_stale_editor(user):
    _, _, values = seed(user)
    draft = command(user, "saveInvoiceDraft", values, None, None)
    edited = command(user, "saveInvoiceDraft", {**values, "title": "Edited"}, draft["_id"], 1)
    with pytest.raises(Conflict):
        command(user, "saveInvoiceDraft", values, draft["_id"], 1)
    with pytest.raises(DomainError):
        command(
            user,
            "addBill",
            {
                **values,
                "draftId": draft["_id"],
                "draftRevision": edited["revision"],
                "lineItems": [],
            },
        )
    assert Record.objects.filter(kind="invoiceDrafts").count() == 1
    workspace = workspace_for(user)
    assert workspace.sequences == {}
    issued = command(
        user, "addBill", {**values, "draftId": draft["_id"], "draftRevision": edited["revision"]}
    )
    assert (
        command(user, "addBill", {**values, "draftId": draft["_id"], "draftRevision": 1}) == issued
    )
    assert not Record.objects.filter(kind="invoiceDrafts").exists()


def test_quotation_accepted_prices_and_single_conversion(user):
    _, product, values = seed(user)
    quote = command(
        user,
        "saveQuotation",
        {**values, "dueDate": (timezone.localdate() + timedelta(days=15)).isoformat()},
    )
    quote = command(user, "setQuotationStatus", quote["_id"], 1, "accepted")
    command(user, "editProduct", product["_id"], {"name": "Changed", "price": 999})
    conversion = {
        "quotationId": quote["_id"],
        "quotationRevision": quote["revision"],
        "date": today(),
    }
    bill = command(user, "addBill", conversion)
    assert bill["total"] == 200
    assert bill["lineItems"][0]["name"] == "Service"
    assert command(user, "addBill", conversion) == bill
    assert Invoice.objects.count() == 1


def test_payments_reversals_credits_and_immutability(user):
    customer, product, values = seed(user)
    bill = command(user, "addBill", values)
    bill = command(
        user, "recordPayment", bill["_id"], {"amount": 100, "method": "Cash", "date": today()}
    )
    with pytest.raises(DomainError):
        command(
            user, "recordPayment", bill["_id"], {"amount": 101, "method": "Cash", "date": today()}
        )
    with pytest.raises(DomainError):
        command(user, "correctInvoice", bill["_id"], {"action": "cancel", "reason": "Closed"})
    bill = command(
        user,
        "correctInvoice",
        bill["_id"],
        {"action": "reverse", "paymentId": bill["payments"][0]["_id"], "reason": "Recorded twice"},
    )
    bill = command(
        user, "correctInvoice", bill["_id"], {"action": "credit", "reason": "Service cancelled"}
    )
    assert bill["creditNote"]["amount"] == 200
    assert bill["creditNote"]["number"].endswith("000001")
    for action, args in [
        ("removeBill", [bill["_id"]]),
        ("removeCustomer", [customer["_id"]]),
        ("removeProduct", [product["_id"]]),
    ]:
        with pytest.raises(DomainError):
            command(user, action, *args)


def test_stock_and_followup_history_and_templates(user):
    customer, product, values = seed(user)
    stock = command(
        user,
        "recordStockMovement",
        {
            "product": product["_id"],
            "revision": 0,
            "type": "opening",
            "delta": 10,
            "reorderLevel": 3,
            "reason": "Counted",
        },
    )
    with pytest.raises(Conflict):
        command(
            user,
            "recordStockMovement",
            {
                "product": product["_id"],
                "revision": 0,
                "type": "adjustment",
                "delta": -1,
                "reorderLevel": 3,
                "reason": "Damaged",
            },
        )
    command(user, "addBill", values)
    assert snapshot(workspace_for(user))["stockRecords"][0] == stock
    task = command(
        user,
        "saveFollowUp",
        {
            "customer": customer["_id"],
            "title": "Call buyer",
            "dueDate": today(),
            "channel": "Phone",
            "purpose": "Collection",
            "priority": "High",
        },
        None,
        None,
    )
    completed = command(user, "setFollowUpStatus", task["_id"], 1, "completed", "Spoke to buyer")
    assert len(completed["history"]) == 2
    template = command(user, "saveInvoiceTemplate", {**values, "title": "Repeat order"})
    draft = command(user, "draftFromTemplate", template["_id"])
    assert draft["customer"] == "" and draft["dueDate"] == ""
    assert "invoiceNumber" not in draft


def test_import_preview_commit_idempotency_and_sequence_continuity(user):
    _, _, values = seed(user)
    command(user, "addBill", values)
    state = snapshot(workspace_for(user))
    target = User.objects.create_user(
        "restore@example.test",
        "AnotherPrivate#8572",
        business_name="Restored business",
        business_address="Mumbai",
    )
    payload = {"format": "billflow-workspace", "version": 1, "workspace": state}
    checked = preview(target, payload)
    assert checked["canImport"]
    values = {**checked, "payload": payload, "confirmation": "IMPORT"}
    assert commit(target, values) == commit(target, values)
    new = command(
        target,
        "addBill",
        {
            "date": today(),
            "customer": state["customers"][0]["_id"],
            "billingAddress": "Mumbai",
            "lineItems": [{"product": state["products"][0]["_id"], "quantity": 1}],
        },
    )
    assert new["invoiceNumber"].endswith("000002")
    changed = deepcopy(payload)
    changed["workspace"]["bills"][0]["total"] = 0
    with pytest.raises(DomainError):
        preview(target, changed)
    changed = deepcopy(payload)
    changed["workspace"]["invoiceSequences"] = {}
    with pytest.raises(DomainError):
        preview(target, changed)
    fresh = User.objects.create_user("fresh@example.test", "AnotherPrivate#8572")
    checked = preview(fresh, payload)
    command(fresh, "addProduct", {"name": "Intervening", "price": 1})
    with pytest.raises(Conflict):
        commit(fresh, {**checked, "payload": payload, "confirmation": "IMPORT"})


def test_mail_capture_quotas_and_private_content(user, settings, tmp_path):
    settings.BASE_DIR = tmp_path
    settings.EMAIL_BUDGET_DAILY = 1
    from django.core.mail import send_mail

    send_mail("Verify", "Private token", "accounts@localhost", [user.email])
    send_mail("Recover", "Another private token", "accounts@localhost", [user.email])
    management.call_command("deliver_mail", limit=10)
    assert Delivery.objects.filter(status="captured").count() == 1
    assert Delivery.objects.filter(status="pending").count() == 1
    assert Delivery.objects.get(status="captured").body == ""
    assert len(list((tmp_path / ".local" / "mail").glob("*.json"))) == 1


def test_delete_requires_password_and_confirmation(user, api):
    seed(user)
    assert (
        api.post(
            "/api/v1/account/delete", {"password": "wrong", "confirmation": "DELETE"}, format="json"
        ).status_code
        == 400
    )
    response = api.post(
        "/api/v1/account/delete",
        {"password": "PrivatePassword#2581", "confirmation": "DELETE"},
        format="json",
    )
    assert response.status_code == 200
    assert not User.objects.filter(pk=user.pk).exists()
    assert Record.objects.count() == 0


def test_preview_never_reserves_a_document_number(user, api):
    _, _, values = seed(user)
    previewed = api.post("/api/v1/invoices/preview", values, format="json")
    assert previewed.status_code == 200
    assert previewed.json()["total"] == 200
    assert "invoiceNumber" not in previewed.json()
    assert Invoice.objects.count() == 0
    assert workspace_for(user).sequences == {}


def test_database_failure_rolls_back_issuance_and_number(user, monkeypatch):
    from billing.models import CommandReceipt

    _, _, values = seed(user)
    draft = command(user, "saveInvoiceDraft", values, None, None)

    def fail(*args, **kwargs):
        raise RuntimeError("Simulated write failure")

    monkeypatch.setattr(CommandReceipt.objects, "create", fail)
    with pytest.raises(RuntimeError):
        command(user, "addBill", {**values, "draftId": draft["_id"], "draftRevision": 1})
    assert Invoice.objects.count() == 0
    assert workspace_for(user).sequences == {}
    assert Record.objects.filter(kind="invoiceDrafts").count() == 1


@pytest.mark.django_db(transaction=True)
def test_parallel_issuance_has_unique_gap_free_numbers():
    user = User.objects.create_user(
        "parallel@example.test",
        "PrivateParallel#438",
        business_name="Parallel business",
        business_address="Mumbai",
    )
    _, _, values = seed(user)

    def issue(_):
        close_old_connections()
        try:
            owner = User.objects.get(pk=user.pk)
            return command(owner, "addBill", values)["invoiceNumber"]
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=4) as pool:
        numbers = list(pool.map(issue, range(8)))
    assert sorted(numbers) == [f"BF/{financial_year(today())}/{i:06d}" for i in range(1, 9)]
    assert AuditEvent.objects.filter(action="addBill").count() == 8
