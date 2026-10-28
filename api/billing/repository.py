import hashlib
import json
import uuid
from copy import deepcopy

from django.db import transaction

from .models import AuditEvent, CommandReceipt, Invoice, Record, Workspace
from .operations import Operations
from .rules import COLLECTIONS, Conflict, DomainError, paise


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def workspace_for(user):
    return Workspace.objects.get_or_create(owner=user)[0]


def snapshot(workspace):
    state = {key: [] for key in COLLECTIONS}
    for record in Record.objects.filter(workspace=workspace).order_by("id"):
        state[record.kind].append(record.data)
    state["bills"] = list(
        Invoice.objects.filter(workspace=workspace).order_by("id").values_list("data", flat=True)
    )
    state.update(
        settings=workspace.settings,
        invoiceSequences=workspace.sequences,
        quotationSequence=workspace.quotation_sequence,
    )
    return state


def persist(workspace, before, after):
    for kind in COLLECTIONS:
        old = {r.get("_id", r.get("product")): r for r in before[kind]}
        new = {r.get("_id", r.get("product")): r for r in after[kind]}
        model = Invoice if kind == "bills" else Record
        queryset = model.objects.filter(workspace=workspace)
        if kind != "bills":
            queryset = queryset.filter(kind=kind)
        for key in old.keys() - new.keys():
            queryset.filter(key=key).delete()
        for key, data in new.items():
            if old.get(key) == data:
                continue
            fields = {"data": data}
            if kind == "bills":
                fields.update(
                    number=data.get("invoiceNumber"),
                    total_paise=paise(data["total"]),
                    source_draft=data.get("sourceDraftId"),
                    source_quotation=data.get("sourceQuotationId"),
                )
            identity = {"workspace": workspace, "key": key}
            if kind != "bills":
                identity["kind"] = kind
            model.objects.update_or_create(**identity, defaults=fields)
    workspace.settings = after["settings"]
    workspace.sequences = after["invoiceSequences"]
    workspace.quotation_sequence = after["quotationSequence"]
    workspace.revision += 1
    workspace.save(update_fields=["settings", "sequences", "quotation_sequence", "revision"])


def execute(user, action, args, key):
    try:
        key = uuid.UUID(str(key))
    except (ValueError, TypeError, AttributeError) as exc:
        raise DomainError("A UUID Idempotency-Key is required.") from exc
    fingerprint = digest({"action": action, "args": args})
    workspace = workspace_for(user)
    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
        receipt = CommandReceipt.objects.filter(workspace=workspace, key=key).first()
        if receipt:
            if receipt.digest != fingerprint:
                raise Conflict("This request key was used for a different command.")
            return receipt.result
        before = snapshot(workspace)
        after = deepcopy(before)
        result = Operations(after, user).dispatch(action, args)
        persist(workspace, before, after)
        AuditEvent.objects.create(
            workspace=workspace, actor=user, action=action, revision=workspace.revision
        )
        CommandReceipt.objects.create(
            workspace=workspace, key=key, digest=fingerprint, result=result
        )
        return result
