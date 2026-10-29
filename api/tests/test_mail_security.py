from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest
from django.core.mail import EmailMessage
from django.db import close_old_connections, connections
from django.test import RequestFactory
from django.utils import timezone

from accounts.adapters import AccountAdapter
from mail.backend import private_key
from mail.management.commands.deliver_mail import claim
from mail.models import Budget, Delivery

pytestmark = pytest.mark.django_db


def enqueue(email, purpose="verification", origin="source", body="private token"):
    message = EmailMessage("Account message", body, "accounts@localhost", [email])
    message.billflow_purpose = purpose
    message.billflow_origin = private_key(origin)
    message.billflow_coalesce_key = private_key(email.lower() + ":same-account-state")
    return message.send()


def test_verification_queue_cannot_block_recovery_admission(settings):
    settings.EMAIL_QUEUE_PER_PURPOSE = 1
    assert enqueue("first@example.test") == 1
    assert enqueue("second@example.test") == 0
    assert enqueue("owner@example.test", "recovery") == 1
    assert claim().purpose == "recovery"


def test_purpose_budget_preserves_recovery_and_global_spend_ceiling():
    now = timezone.now()
    Budget.objects.create(key="V" + now.strftime("%Y%m%d"), attempts=1000)
    enqueue("signup@example.test")
    enqueue("owner@example.test", "recovery")
    row = claim()
    assert row.purpose == "recovery"
    assert Budget.objects.get(key="D" + now.strftime("%Y%m%d")).attempts == 1
    assert Budget.objects.get(key="R" + now.strftime("%Y%m%d")).attempts == 1
    assert Delivery.objects.get(purpose="verification").attempts == 0


def test_coalescing_never_changes_a_leased_payload_or_idempotency_identity():
    assert enqueue("owner@example.test") == 1
    row = claim()
    original = (row.pk, row.body, row.subject, row.lease_until)
    assert enqueue("OWNER@example.test", body="a different token") == 0
    row.refresh_from_db()
    assert (row.pk, row.body, row.subject, row.lease_until) == original
    assert Delivery.objects.count() == 1


def test_recipient_limits_survive_scrubbing_and_are_separate_for_security(settings):
    settings.EMAIL_RECIPIENT_DAILY = 1
    enqueue("owner@example.test", "recovery")
    Delivery.objects.update(status="captured", recipient="", body="", html="", subject="")
    assert enqueue("OWNER@example.test", "recovery") == 0
    assert enqueue("owner@example.test", "security") == 1


def test_origin_limits_are_per_purpose(settings):
    settings.EMAIL_ORIGIN_HOURLY = 1
    assert enqueue("first@example.test") == 1
    assert enqueue("other@example.test") == 0
    assert enqueue("owner@example.test", "recovery") == 1


def test_public_duplicate_signup_cannot_claim_security_quota_or_spoof_origin(settings):
    settings.ALLAUTH_TRUSTED_PROXY_COUNT = 0
    adapter = AccountAdapter()
    messages = []
    with patch(
        "allauth.account.adapter.DefaultAccountAdapter.render_mail",
        side_effect=lambda *a, **kw: EmailMessage(),
    ):
        for address in ["2001:db8::1", "2001:db8::2"]:
            request = RequestFactory().get(
                "/", REMOTE_ADDR=address, HTTP_X_FORWARDED_FOR="attacker"
            )
            messages.append(
                adapter.render_mail(
                    "account/email/account_already_exists",
                    "owner@example.test",
                    {"request": request},
                )
            )
    assert messages[0].billflow_purpose == "verification"
    assert messages[0].billflow_origin == messages[1].billflow_origin
    assert "2001" not in messages[0].billflow_origin


@pytest.mark.django_db(transaction=True)
def test_concurrent_queue_admission_cannot_exceed_source_limit(settings):
    settings.EMAIL_ORIGIN_HOURLY = 3

    def send(index):
        close_old_connections()
        try:
            return enqueue(f"recipient{index}@example.test")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(send, range(8)))
    assert sum(results) == Delivery.objects.count() == 3


def test_password_change_admits_a_fresh_reset_link_without_mutating_old_delivery(user):
    adapter = AccountAdapter()
    request = RequestFactory().get("/")
    with patch(
        "allauth.account.adapter.DefaultAccountAdapter.render_mail",
        side_effect=lambda *a, **kw: EmailMessage(
            "Reset", "link", "accounts@localhost", [user.email]
        ),
    ):
        old = adapter.render_mail(
            "account/email/password_reset_key", user.email, {"request": request, "user": user}
        )
        assert old.send() == 1
        user.set_password("ChangedPrivate#4289")
        user.save(update_fields=["password"])
        fresh = adapter.render_mail(
            "account/email/password_reset_key", user.email, {"request": request, "user": user}
        )
        assert fresh.billflow_coalesce_key != old.billflow_coalesce_key
        assert fresh.send() == 1
    assert Delivery.objects.count() == 2
