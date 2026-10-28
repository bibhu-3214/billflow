import uuid

from django.db import models


class Delivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.EmailField()
    subject = models.TextField()
    body = models.TextField()
    html = models.TextField(blank=True)
    sender = models.EmailField()
    status = models.CharField(max_length=12, default="pending")
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    next_attempt = models.DateTimeField()
    lease_until = models.DateTimeField(null=True)


class Budget(models.Model):
    key = models.CharField(max_length=12, primary_key=True)
    attempts = models.PositiveIntegerField(default=0)
