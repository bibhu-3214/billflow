import json

from allauth.account.adapter import DefaultAccountAdapter
from django.core.exceptions import ValidationError


class AccountAdapter(DefaultAccountAdapter):
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
