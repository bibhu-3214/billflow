import uuid

from django.conf import settings
from django.db import models


class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    settings = models.JSONField(default=dict)
    sequences = models.JSONField(default=dict)
    quotation_sequence = models.PositiveIntegerField(default=0)
    revision = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Record(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    kind = models.CharField(max_length=24)
    key = models.CharField(max_length=100)
    data = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "kind", "key"], name="record_identity")
        ]


class Invoice(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    key = models.CharField(max_length=100)
    number = models.CharField(max_length=30, null=True)
    total_paise = models.PositiveBigIntegerField()
    source_draft = models.CharField(max_length=100, null=True)
    source_quotation = models.CharField(max_length=100, null=True)
    data = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", field], name="invoice_unique_" + field)
            for field in ["key", "number", "source_draft", "source_quotation"]
        ]


class CommandReceipt(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    key = models.UUIDField()
    digest = models.CharField(max_length=64)
    result = models.JSONField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "key"], name="command_identity")
        ]


class AuditEvent(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    action = models.CharField(max_length=40)
    revision = models.PositiveBigIntegerField()
    at = models.DateTimeField(auto_now_add=True)


class CacheEntry(models.Model):
    cache_key = models.CharField(max_length=255, primary_key=True)
    value = models.TextField()
    expires = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "billing_cacheentry"
