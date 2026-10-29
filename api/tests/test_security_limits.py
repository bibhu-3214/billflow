import uuid
from copy import deepcopy
from unittest.mock import patch

import pytest
from django.test import Client

from billing.imports import commit, preview
from billing.models import AuditEvent, CommandReceipt, Invoice, Record
from billing.repository import execute, workspace_for
from billing.rules import Conflict, DomainError, today

pytestmark = pytest.mark.django_db


def transfer():
    return {
        "format": "billflow-workspace",
        "version": 1,
        "workspace": {"customers": [], "products": [], "bills": []},
    }


def test_import_rejects_oversize_lines_before_catalog_lookups(user):
    payload = transfer()
    payload["workspace"]["bills"] = [{"_id": "b", "lineItems": [{"product": "p"}] * 101}]
    with patch("billing.imports.require", side_effect=AssertionError("lookup before bounds")):
        for operation in [
            lambda: preview(user, payload),
            lambda: commit(user, {"confirmation": "IMPORT", "payload": payload}),
        ]:
            with pytest.raises(DomainError, match="nested record limit"):
                operation()
    assert not Invoice.objects.exists()


def test_import_rejects_large_unknown_record_fields(user):
    payload = transfer()
    payload["workspace"]["customers"] = [{"_id": "c", "extra": "x" * 9000}]
    with pytest.raises(DomainError, match="record size limit"):
        preview(user, payload)


def test_import_has_aggregate_work_limit(user, settings):
    settings.IMPORT_MAX_WORK_ITEMS = 1
    payload = transfer()
    payload["workspace"]["products"] = [{"_id": "p"}, {"_id": "q"}]
    with pytest.raises(DomainError, match="work limit"):
        preview(user, payload)


def test_receipt_capacity_preserves_exact_replay_and_blocks_only_new_writes(user, settings):
    settings.COMMAND_RECEIPT_MAX_COUNT = 1
    key = uuid.uuid4()
    args = [{"name": "Service", "price": 100}]
    original = execute(user, "addProduct", args, key)
    assert execute(user, "addProduct", args, key) == original
    with pytest.raises(Conflict):
        execute(user, "addProduct", [{"name": "Other", "price": 1}], key)
    with pytest.raises(DomainError, match="history limit"):
        execute(user, "addProduct", args, uuid.uuid4())
    assert (
        Record.objects.count() == CommandReceipt.objects.count() == AuditEvent.objects.count() == 1
    )


def test_receipt_size_failure_rolls_back_financial_numbering_and_audit(user, settings):
    customer = execute(
        user, "addCustomer", [{"name": "Buyer", "mobile": "9876543210"}], uuid.uuid4()
    )
    product = execute(user, "addProduct", [{"name": "Service", "price": 100}], uuid.uuid4())
    workspace = workspace_for(user)
    before = deepcopy(workspace.sequences)
    revision = workspace.revision
    settings.COMMAND_RESULT_MAX_BYTES = 1
    with pytest.raises(DomainError, match="history storage limit"):
        execute(
            user,
            "addBill",
            [
                {
                    "customer": customer["_id"],
                    "date": today(),
                    "billingAddress": "Mumbai",
                    "lineItems": [{"product": product["_id"], "quantity": 1}],
                }
            ],
            uuid.uuid4(),
        )
    workspace.refresh_from_db()
    assert not Invoice.objects.exists()
    assert workspace.sequences == before and workspace.revision == revision
    assert CommandReceipt.objects.count() == AuditEvent.objects.count() == 2


def test_production_headers_cover_responses_without_weakening_dev(settings):
    settings.DEBUG = False
    response = Client().get("/api/v1/health/live")
    assert "object-src 'none'" in response["Content-Security-Policy"]
    assert "script-src 'self'" in response["Content-Security-Policy"]
    assert "'unsafe-eval'" not in response["Content-Security-Policy"]
    assert "camera=()" in response["Permissions-Policy"]
    settings.DEBUG = True
    assert "Content-Security-Policy" not in Client().get("/api/v1/health/live")
