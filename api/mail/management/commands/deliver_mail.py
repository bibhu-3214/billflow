import json
import os
import urllib.error
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from mail.models import Budget, Delivery


def claim():
    now = timezone.now()
    with transaction.atomic():
        Delivery.objects.filter(expires_at__lte=now).exclude(
            status__in=["sent", "captured", "expired"]
        ).update(status="expired", body="", html="", recipient="", subject="")
        # One fixed lock serializes budget reservations across workers.
        Budget.objects.get_or_create(key="lock")
        Budget.objects.select_for_update().get(key="lock")
        keys = [
            ("D" + now.strftime("%Y%m%d"), settings.EMAIL_BUDGET_DAILY),
            ("M" + now.strftime("%Y%m"), settings.EMAIL_BUDGET_MONTHLY),
        ]
        budgets = []
        for key, limit in keys:
            budget, _ = Budget.objects.get_or_create(key=key)
            if budget.attempts >= limit:
                return None
            budgets.append(budget)
        row = (
            Delivery.objects.select_for_update(skip_locked=True)
            .filter(
                status="pending",
                next_attempt__lte=now,
                expires_at__gt=now,
                attempts__lt=8,
            )
            .filter(Q(lease_until__isnull=True) | Q(lease_until__lte=now))
            .order_by("created_at")
            .first()
        )
        if row is None:
            return None
        row.attempts += 1
        row.lease_until = now + timedelta(minutes=2)
        row.save(update_fields=["attempts", "lease_until"])
        for budget in budgets:
            budget.attempts += 1
            budget.save(update_fields=["attempts"])
        return row


def deliver(row):
    payload = {"from": row.sender, "to": [row.recipient], "subject": row.subject, "text": row.body}
    if row.html:
        payload["html"] = row.html
    if settings.EMAIL_DELIVERY_MODE == "capture":
        directory = settings.BASE_DIR / ".local" / "mail"
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = directory / (str(row.id) + ".json")
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as file:
            json.dump(payload, file)
        return "captured"
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": "Bearer " + settings.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": "billflow-" + str(row.id),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if not 200 <= response.status < 300:
            raise OSError("Mail provider did not accept delivery.")
    return "sent"


class Command(BaseCommand):
    help = "Deliver a bounded outbox batch. Never logs email addresses, bodies or credentials."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=20)

    def handle(self, *args, **options):
        count = 0
        for _ in range(max(0, min(options["limit"], 100))):
            row = claim()
            if row is None:
                break
            try:
                status = deliver(row)
            except (OSError, urllib.error.URLError):
                Delivery.objects.filter(pk=row.pk, lease_until=row.lease_until).update(
                    next_attempt=timezone.now()
                    + timedelta(seconds=min(3600, 30 * 2**row.attempts)),
                    lease_until=None,
                )
                continue
            Delivery.objects.filter(pk=row.pk, lease_until=row.lease_until).update(
                status=status, body="", html="", recipient="", subject="", lease_until=None
            )
            count += 1
        self.stdout.write(f"Processed {count} deliveries.")
