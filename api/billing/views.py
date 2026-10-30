from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import logout
from django.db import connection, transaction
from django.http import FileResponse, Http404, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework.response import Response
from rest_framework.views import APIView

from . import imports
from .operations import Operations
from .repository import execute, snapshot, workspace_for
from .rules import DomainError


@require_GET
def live(request):
    return JsonResponse({"status": "ok"})


@require_GET
def ready(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ready"})


@require_GET
@ensure_csrf_cookie
def config(request):
    return JsonResponse(
        {
            "csrfToken": get_token(request),
            "supportEmail": settings.SUPPORT_EMAIL or None,
            "providers": sorted(settings.SOCIALACCOUNT_PROVIDERS),
            "freeLaunch": True,
            "backend": "django",
            "platforms": ["web", "android", "ios"],
        }
    )


def csrf_failure(request, reason=""):
    return JsonResponse(
        {"detail": "Your session needs refreshing. Reload and try again."}, status=403
    )


@require_GET
def web_app(request, route=""):
    if route.split("/", 1)[0] in {
        "api",
        "_allauth",
        "accounts",
        "static",
        "assets",
        "fonts",
        "licenses",
    }:
        raise Http404
    file = settings.WEB_BUILD / "index.html"
    if not file.is_file():
        raise Http404("Build the connected web client first.")
    response = FileResponse(file.open("rb"), content_type="text/html")
    response["Cache-Control"] = "no-cache"
    return response


def profile(user):
    return {
        "_id": str(user.pk),
        "email": user.email,
        "username": user.display_name or user.email.split("@")[0],
        "businessName": user.business_name or "Your business",
        "address": user.business_address,
        "isCloud": True,
    }


class DomainView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, DomainError):
            return Response({"detail": str(exc)}, status=exc.status)
        if isinstance(exc, (TypeError, KeyError, AttributeError, ValueError)):
            return Response(
                {"detail": "The request contains invalid or missing fields."}, status=400
            )
        return super().handle_exception(exc)


class MeView(DomainView):
    def get(self, request):
        return Response({"user": profile(request.user)})


class AccountDeleteView(DomainView):
    def post(self, request):
        password = request.data.get("password")
        if (
            request.data.get("confirmation") != "DELETE"
            or not isinstance(password, str)
            or len(password) > 128
            or not request.user.check_password(password)
        ):
            raise DomainError(
                "Confirm DELETE and enter your current account password. Social accounts must set a password through recovery first."
            )
        with transaction.atomic():
            user = request.user
            # Prevent parallel billing writes while deleting this business.
            from .models import Workspace

            Workspace.objects.select_for_update().filter(owner=user).first()
            EmailAddress.objects.filter(user=user).delete()
            user.delete()
            logout(request)
        return Response({"deleted": True})


class WorkspaceView(DomainView):
    def get(self, request):
        workspace = workspace_for(request.user)
        # Read collections and metadata from one transaction/lock, never a torn snapshot.
        from .models import Workspace

        with transaction.atomic():
            workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
            return Response(
                {
                    "format": "billflow-workspace",
                    "version": 1,
                    "revision": workspace.revision,
                    "workspace": snapshot(workspace),
                    "profile": profile(request.user),
                }
            )


READS = {
    "getCustomers": "customers",
    "getProducts": "products",
    "getBills": "bills",
    "getInvoiceDrafts": "invoiceDrafts",
    "getQuotations": "quotations",
    "getInvoiceTemplates": "invoiceTemplates",
    "getStockRecords": "stockRecords",
    "getFollowUps": "followUps",
    "getHistoricalSales": "historicalSales",
}


class ActionView(DomainView):
    def post(self, request, action):
        if not isinstance(request.data, dict):
            raise DomainError("A JSON object is required.")
        args = request.data.get("args", [])
        if not isinstance(args, list):
            raise DomainError("Command arguments must be an array.")
        if action in READS or action in ["getSettings", "getBill"]:
            workspace = workspace_for(request.user)
            state = snapshot(workspace)
            if action in READS:
                result = state[READS[action]]
                if action in ["getQuotations", "getInvoiceTemplates"]:
                    result = list(reversed(result))
                if action == "getInvoiceDrafts":
                    result = sorted(result, key=lambda r: r.get("updatedAt", ""), reverse=True)
                return Response(result)
            if action == "getSettings":
                return Response(Operations(state, request.user).profile())
            from .rules import require

            if len(args) != 1:
                raise DomainError("An invoice ID is required.")
            return Response(require(state["bills"], args[0]))
        return Response(execute(request.user, action, args, request.headers.get("Idempotency-Key")))


class ImportPreviewView(DomainView):
    def post(self, request):
        return Response(imports.preview(request.user, request.data))


class InvoicePreviewView(DomainView):
    def post(self, request):
        from .models import Workspace
        from .rules import Conflict

        workspace = workspace_for(request.user)
        with transaction.atomic():
            workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
            invoice = Operations(snapshot(workspace), request.user).invoice(request.data)
            if (
                invoice.get("sourceDraftId")
                and request.data.get("draftId")
                and not any(
                    r.key == request.data["draftId"]
                    for r in workspace.record_set.filter(kind="invoiceDrafts")
                )
            ):
                raise Conflict("This draft was already issued. Reopen the invoice history.")
            return Response(
                {
                    key: invoice[key]
                    for key in [
                        "gross",
                        "discountAmount",
                        "taxable",
                        "cgst",
                        "stateTax",
                        "igst",
                        "total",
                        "localTax",
                        "interstate",
                    ]
                }
            )


class ImportCommitView(DomainView):
    def post(self, request):
        return Response(imports.commit(request.user, request.data))
