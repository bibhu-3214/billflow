import hashlib
import json
import uuid
from copy import deepcopy

from django.conf import settings
from django.db import transaction
from django.db.models import BigIntegerField, Count, Func, Sum, TextField
from django.db.models.functions import Cast

from .limits import check_workspace_size, encoded_size
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
    check_workspace_size(after)
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
        allocation = CommandReceipt.objects.filter(workspace=workspace).aggregate(
            count=Count("id"),
            size=Sum(
                Func(
                    Cast("result", TextField()),
                    function="OCTET_LENGTH",
                    output_field=BigIntegerField(),
                )
            ),
        )
        if allocation["count"] >= settings.COMMAND_RECEIPT_MAX_COUNT:
            raise DomainError("Command history limit reached. Export a backup and contact support.")
        before = snapshot(workspace)
        after = deepcopy(before)
        result = Operations(after, user).dispatch(action, args)
        result_size = encoded_size(result)
        if (
            result_size > settings.COMMAND_RESULT_MAX_BYTES
            or (allocation["size"] or 0) + result_size > settings.COMMAND_RECEIPT_MAX_BYTES
        ):
            raise DomainError(
                "Command history storage limit reached. Export a backup and contact support."
            )
        persist(workspace, before, after)
        AuditEvent.objects.create(
            workspace=workspace, actor=user, action=action, revision=workspace.revision
        )
        CommandReceipt.objects.create(
            workspace=workspace, key=key, digest=fingerprint, result=result
        )
        return result
