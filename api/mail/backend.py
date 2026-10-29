from datetime import timedelta

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from .models import Budget, Delivery


def private_key(value):
    return salted_hmac("billflow-mail-admission", value, algorithm="sha256").hexdigest()


class OutboxBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        count = 0
        for message in email_messages or []:
            html = next(
                (a[0] for a in getattr(message, "alternatives", []) if a[1] == "text/html"), ""
            )
            purpose = getattr(message, "billflow_purpose", "verification")
            if purpose not in {"verification", "recovery", "security"}:
                purpose = "verification"
            origin = getattr(message, "billflow_origin", "internal")
            coalesce_key = getattr(message, "billflow_coalesce_key", "")
            for recipient in message.to:
                now = timezone.now()
                recipient_key = private_key(recipient.strip().lower())
                with transaction.atomic():
                    Budget.objects.get_or_create(key="lock")
                    Budget.objects.select_for_update().get(key="lock")
                    lane = Delivery.objects.filter(purpose=purpose)
                    pending = lane.filter(status="pending", expires_at__gt=now)
                    # Suppress repeats; never mutate a payload already leased or attempted.
                    if (
                        purpose != "security"
                        and coalesce_key
                        and pending.filter(
                            recipient_key=recipient_key, coalesce_key=coalesce_key
                        ).exists()
                    ):
                        continue
                    recent = lane.filter(created_at__gte=now - timedelta(days=1))
                    if (
                        pending.count() >= settings.EMAIL_QUEUE_PER_PURPOSE
                        or recent.filter(recipient_key=recipient_key).count()
                        >= settings.EMAIL_RECIPIENT_DAILY
                    ):
                        continue
                    if origin != "internal":
                        source = recent.filter(origin=origin)
                        if (
                            source.count() >= settings.EMAIL_ORIGIN_DAILY
                            or source.filter(created_at__gte=now - timedelta(hours=1)).count()
                            >= settings.EMAIL_ORIGIN_HOURLY
                        ):
                            continue
                    Delivery.objects.create(
                        recipient=recipient,
                        recipient_key=recipient_key,
                        origin=origin,
                        purpose=purpose,
                        coalesce_key=coalesce_key,
                        sender=message.from_email,
                        subject=message.subject,
                        body=message.body,
                        html=html,
                        expires_at=now + timedelta(hours=24),
                        next_attempt=now,
                    )
                    count += 1
        return count
