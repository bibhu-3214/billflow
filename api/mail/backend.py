from datetime import timedelta

from django.core.mail.backends.base import BaseEmailBackend
from django.utils import timezone

from .models import Delivery


class OutboxBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        count = 0
        for message in email_messages or []:
            html = next(
                (a[0] for a in getattr(message, "alternatives", []) if a[1] == "text/html"), ""
            )
            for recipient in message.to:
                Delivery.objects.create(
                    recipient=recipient,
                    sender=message.from_email,
                    subject=message.subject,
                    body=message.body,
                    html=html,
                    expires_at=timezone.now() + timedelta(hours=24),
                    next_attempt=timezone.now(),
                )
                count += 1
        return count
