from django.db import transaction
from rest_framework.response import Response

from .historical import plan
from .models import AuditEvent, Workspace
from .repository import digest, persist, snapshot, workspace_for
from .rules import Conflict, DomainError
from .views import DomainView


class HistoricalSalesPreviewView(DomainView):
    def post(self, request):
        workspace = workspace_for(request.user)
        with transaction.atomic():
            workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
            state = snapshot(workspace)
            proposed = plan(
                request.data.get("payload"),
                state["historicalSales"],
                state["customers"],
                request.data.get("links", {}),
            )
            return Response(
                {**proposed, "digest": digest(proposed), "revision": workspace.revision}
            )


class HistoricalSalesCommitView(DomainView):
    def post(self, request):
        if request.data.get("confirmation") != "IMPORT":
            raise DomainError("Type IMPORT to confirm this historical purchase import.")
        workspace = workspace_for(request.user)
        with transaction.atomic():
            workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
            revision = request.data.get("revision")
            if (
                isinstance(revision, bool)
                or not isinstance(revision, int)
                or revision != workspace.revision
            ):
                raise Conflict("This business changed after preview. Review the import again.")
            before = snapshot(workspace)
            proposed = plan(
                request.data.get("payload"),
                before["historicalSales"],
                before["customers"],
                request.data.get("links", {}),
            )
            if digest(proposed) != request.data.get("digest"):
                raise Conflict("The import changed after preview. Review it again.")
            after = {
                **before,
                "historicalSales": [*before["historicalSales"], *proposed["records"]],
            }
            if proposed["records"]:
                persist(workspace, before, after)
                AuditEvent.objects.create(
                    workspace=workspace,
                    actor=request.user,
                    action="historical-sales-import",
                    revision=workspace.revision,
                )
            return Response(
                {"imported": len(proposed["records"]), "duplicates": proposed["duplicates"]}
            )
