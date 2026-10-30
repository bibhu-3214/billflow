import uuid
from copy import deepcopy

import pytest
from allauth.account.models import EmailAddress
from django.test import Client

from accounts.models import User
from billing.imports import validate
from billing.models import AuditEvent, Invoice
from billing.repository import execute, snapshot, workspace_for
from billing.rules import DomainError

pytestmark = pytest.mark.django_db
STAMP = {"createdAt": "2026-10-30T09:00:00.000Z", "updatedAt": "2026-10-30T09:00:00.000Z"}
ROW = {
    **STAMP,
    "id": "one",
    "name": "Buyer",
    "phone": "123 456 7890",
    "date": "2026-10-30",
    "amountMinor": 29,
}
SOURCE = {"version": 1, "product": "customer-insights", "records": [ROW]}
PREVIEW = "/api/v1/historical-sales/preview"
COMMIT = "/api/v1/historical-sales/commit"


def test_reviewed_history_is_owner_scoped_deduplicated_and_never_creates_invoice_state(api, user):
    customer = execute(
        user,
        "addCustomer",
        [{"name": "Buyer", "mobile": "1234567890", "email": "buyer@example.test"}],
        uuid.uuid4(),
    )
    before = snapshot(workspace_for(user))
    body = {"payload": SOURCE, "links": {"1234567890": customer["_id"]}}
    preview = api.post(PREVIEW, body, format="json")
    assert preview.status_code == 200, preview.data
    review = preview.json()
    assert not snapshot(workspace_for(user))["historicalSales"]
    response = api.post(
        COMMIT,
        {**body, **{key: review[key] for key in ["revision", "digest"]}, "confirmation": "IMPORT"},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.json() == {"imported": 1, "duplicates": 0}
    after = snapshot(workspace_for(user))
    assert after["historicalSales"][0]["amountMinor"] == 29
    assert after["historicalSales"][0]["customerId"] == customer["_id"]
    for key in before:
        if key != "historicalSales":
            assert after[key] == before[key]
    assert Invoice.objects.count() == 0
    assert AuditEvent.objects.filter(action="historical-sales-import").count() == 1
    assert (
        api.post(
            COMMIT,
            {
                **body,
                "revision": review["revision"],
                "digest": review["digest"],
                "confirmation": "IMPORT",
            },
            format="json",
        ).status_code
        == 409
    )
    repeat = api.post(PREVIEW, body, format="json").json()
    assert repeat["records"] == [] and repeat["duplicates"] == 1
    assert (
        validate({"format": "billflow-workspace", "version": 1, "workspace": after})[
            "historicalSales"
        ]
        == after["historicalSales"]
    )
    with pytest.raises(DomainError):
        execute(user, "removeCustomer", [customer["_id"]], uuid.uuid4())


def test_history_rejects_tampering_invalid_rows_foreign_customer_and_unconfirmed_writes(api, user):
    other = User.objects.create_user("other@example.test", "SeparateOwner#4827")
    foreign = execute(
        other,
        "addCustomer",
        [{"name": "Other buyer", "mobile": "1234567890", "email": "otherbuyer@example.test"}],
        uuid.uuid4(),
    )
    assert (
        api.post(
            PREVIEW, {"payload": SOURCE, "links": {"1234567890": foreign["_id"]}}, format="json"
        ).status_code
        == 400
    )
    assert api.post(COMMIT, {"payload": SOURCE}, format="json").status_code == 400
    review = api.post(PREVIEW, {"payload": SOURCE}, format="json").json()
    changed = deepcopy(SOURCE)
    changed["records"][0]["amountMinor"] = 71
    body = {
        "payload": changed,
        "revision": review["revision"],
        "digest": review["digest"],
        "confirmation": "IMPORT",
    }
    assert api.post(COMMIT, body, format="json").status_code == 409
    for patch in [{"date": "2026-02-30"}, {"amountMinor": 1.5}, {"id": []}, {"owner": "foreign"}]:
        assert (
            api.post(
                PREVIEW, {"payload": {**SOURCE, "records": [{**ROW, **patch}]}}, format="json"
            ).status_code
            == 400
        )
    assert snapshot(workspace_for(user))["historicalSales"] == []
    assert snapshot(workspace_for(other))["historicalSales"] == []


def test_history_endpoints_keep_authentication_verification_and_csrf_guards(user):
    anonymous = Client(enforce_csrf_checks=True)
    assert anonymous.post(PREVIEW, {}, content_type="application/json").status_code in [401, 403]
    anonymous.force_login(user)
    assert anonymous.post(COMMIT, {}, content_type="application/json").status_code == 403
    EmailAddress.objects.filter(user=user).update(verified=False)
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user)
    assert client.post(PREVIEW, {"payload": SOURCE}, format="json").status_code == 403
