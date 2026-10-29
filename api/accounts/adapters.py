import json

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core.internal.ratelimit import truncate_ip
from django.core.exceptions import ValidationError

from mail.backend import private_key


class AccountAdapter(DefaultAccountAdapter):
    def render_mail(self, template_prefix, email, context, headers=None):
        message = super().render_mail(template_prefix, email, context, headers=headers)
        if template_prefix == "account/email/password_reset_key":
            message.billflow_purpose = "recovery"
        elif template_prefix in {
            "account/email/email_confirmation",
            "account/email/email_confirmation_signup",
            "account/email/account_already_exists",
            "account/email/unknown_account",
        }:
            message.billflow_purpose = "verification"
        else:
            message.billflow_purpose = "security"
        user = context.get("user")
        if user is not None:
            # Reset keys are invalidated by password/login changes. Only coalesce
            # links generated for the same account state; queued payloads stay immutable.
            message.billflow_coalesce_key = private_key(
                f"{user.pk}:{user.password}:{user.last_login}:{user.email}"
            )
        request = context.get("request")
        message.billflow_origin = (
            private_key(truncate_ip(self.get_client_ip(request))) if request else "internal"
        )
        return message

    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=False)
        values = json.loads(request.body or "{}")
        for key, field, limit in [
            ("username", "display_name", 80),
            ("businessName", "business_name", 120),
            ("address", "business_address", 500),
        ]:
            value = values.get(key, "")
            if not isinstance(value, str) or len(value.strip()) > limit:
                raise ValidationError("Invalid business profile.")
            setattr(user, field, value.strip())
        if commit:
            user.save()
        return user

    def clean_email(self, email):
        return super().clean_email(email).strip().lower()

    def clean_password(self, password, user=None):
        if len(password) > 128:
            raise ValidationError("Use at most 128 characters for a password.")
        return super().clean_password(password, user=user)
