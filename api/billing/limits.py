"""Explicit per-business resource budgets; rejecting writes never discards records."""

import json

from django.conf import settings

from .rules import COLLECTIONS, DomainError


def encoded_size(value):
    try:
        return len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode())
    except (ValueError, TypeError, RecursionError) as exc:
        raise DomainError("The record is not supported JSON.") from exc


def check_workspace_size(state):
    if encoded_size(state) > settings.WORKSPACE_MAX_BYTES:
        raise DomainError("Workspace storage limit reached. Export a backup and contact support.")


def preflight(raw):
    caps = {
        "invoiceDrafts": 200,
        "quotations": 200,
        "invoiceTemplates": 200,
        "stockRecords": 1000,
        "followUps": 500,
    }
    work = 0
    for kind in COLLECTIONS:
        rows = raw.get(kind, [])
        if not isinstance(rows, list) or len(rows) > caps.get(kind, 10000):
            raise DomainError("Workspace collection limit exceeded.")
        work += len(rows)
        for row in rows:
            if not isinstance(row, dict):
                raise DomainError("Workspace record is invalid.")
            for field, limit in [
                ("lineItems", 100),
                ("payments", 1000),
                ("reversals", 1000),
                ("movements", 200),
                ("history", 100),
            ]:
                if field in row:
                    values = row[field]
                    if not isinstance(values, list) or len(values) > limit:
                        raise DomainError("Workspace nested record limit exceeded.")
                    work += len(values)
            if work > settings.IMPORT_MAX_WORK_ITEMS:
                raise DomainError("Workspace transfer work limit exceeded.")
            maximum = 8192 if kind in {"customers", "products"} else 524288
            if encoded_size(row) > maximum:
                raise DomainError("Workspace record size limit exceeded.")
            for field, maximum in [("customerSnapshot", 8192), ("supplierSnapshot", 200000)]:
                if field in row and encoded_size(row[field]) > maximum:
                    raise DomainError("Invoice party snapshot size limit exceeded.")
    if encoded_size(raw.get("settings", {})) > 200000:
        raise DomainError("Business settings size limit exceeded.")
    check_workspace_size(raw)
