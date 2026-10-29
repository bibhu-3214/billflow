"""Create a private, reusable sign-in account for the loopback development stack."""

import json
import os
import secrets

from allauth.account.models import EmailAddress
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction

from accounts.models import User


def ensure_local_login():
    database = settings.DATABASES["default"]
    host = database.get("HOST") or database.get("OPTIONS", {}).get("host", "")
    if (
        settings.SETTINGS_MODULE != "config.settings.development"
        or not settings.DEBUG
        or settings.EMAIL_DELIVERY_MODE != "capture"
        or not host.startswith("/")
    ):
        return None

    folder = settings.BASE_DIR / ".local"
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = folder / "local-login.json"
    if path.exists():
        credentials = json.loads(path.read_text())
        if not User.objects.filter(pk=credentials["userId"], email=credentials["email"]).exists():
            raise ImproperlyConfigured(
                "The local test account was removed. Remove api/.local/local-login.json "
                "and restart to create a new test account."
            )
        path.chmod(0o600)
        return credentials

    email = "local.owner@billflow.test"
    while User.objects.filter(email__iexact=email).exists():
        email = f"local.owner.{secrets.token_hex(4)}@billflow.test"
    password = secrets.token_urlsafe(24) + "aA1!"
    created = False
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email, password, display_name="Local owner", business_name="My test workspace"
            )
            EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
            credentials = {"userId": str(user.pk), "email": email, "password": password}
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            created = True
            with os.fdopen(descriptor, "w") as stream:
                json.dump(credentials, stream)
                stream.write("\n")
    except Exception:
        if created:
            path.unlink(missing_ok=True)
        raise
    return credentials
