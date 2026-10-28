from allauth.account.models import EmailAddress
from rest_framework.permissions import BasePermission


class VerifiedAccount(BasePermission):
    message = "Sign in with a verified email address."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and EmailAddress.objects.filter(
                user=request.user, email__iexact=request.user.email, verified=True
            ).exists()
        )
