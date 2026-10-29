import uuid

from django.db import models


class Delivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.EmailField()
    recipient_key = models.CharField(max_length=64, blank=True, default="", db_index=True)
    origin = models.CharField(max_length=64, blank=True, default="", db_index=True)
    purpose = models.CharField(max_length=16, default="security", db_index=True)
    coalesce_key = models.CharField(max_length=64, blank=True, default="")
    subject = models.TextField()
    body = models.TextField()
    html = models.TextField(blank=True)
    sender = models.EmailField()
    status = models.CharField(max_length=12, default="pending")
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField()
    next_attempt = models.DateTimeField()
    lease_until = models.DateTimeField(null=True)


class Budget(models.Model):
    key = models.CharField(max_length=12, primary_key=True)
    attempts = models.PositiveIntegerField(default=0)
