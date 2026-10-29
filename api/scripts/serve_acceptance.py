"""Disposable browser acceptance service. Run only through --temporary PostgreSQL."""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
import django

django.setup()
from allauth.account.models import EmailAddress
from django.conf import settings
from django.core.management import call_command

from accounts.models import User

if not settings.DEBUG or settings.SETTINGS_MODULE != "config.settings.test":
    raise SystemExit("Acceptance fixtures require isolated test settings.")
call_command("migrate", verbosity=0, interactive=False)
for name in [
    "acceptance",
    "acceptance-desktop",
    "acceptance-tablet",
    "acceptance-phone",
    "acceptance-controls-desktop",
    "acceptance-controls-tablet",
    "acceptance-controls-phone",
]:
    user = User.objects.create_user(
        name + "@example.test",
        "AcceptanceOnly#4827",
        display_name="Acceptance Owner",
        business_name="North Studio",
        business_address="Mumbai",
    )
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
call_command("runserver", "127.0.0.1:8001", use_reloader=False)
