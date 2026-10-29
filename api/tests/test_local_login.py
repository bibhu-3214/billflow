import json
import stat

import pytest
from allauth.account.models import EmailAddress
from django.test import Client

from accounts.models import User
from scripts.local_login import ensure_local_login

pytestmark = pytest.mark.django_db


def enable_local(settings, tmp_path):
    settings.BASE_DIR = tmp_path
    settings.DEBUG = True
    settings.EMAIL_DELIVERY_MODE = "capture"
    settings.SETTINGS_MODULE = "config.settings.development"


def test_local_login_is_verified_reusable_and_does_not_change_other_users(settings, tmp_path, user):
    enable_local(settings, tmp_path)
    original_password = user.password
    credentials = ensure_local_login()
    assert ensure_local_login() == credentials
    assert User.objects.count() == 2
    owner = User.objects.get(pk=credentials["userId"])
    assert owner.check_password(credentials["password"])
    assert not owner.is_staff and not owner.is_superuser
    assert EmailAddress.objects.get(user=owner).verified
    user.refresh_from_db()
    assert user.password == original_password
    path = tmp_path / ".local" / "local-login.json"
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert json.loads(path.read_text()) == credentials
    client = Client()
    response = client.post(
        "/_allauth/browser/v1/auth/login",
        {"email": credentials["email"], "password": credentials["password"]},
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    assert client.get("/api/v1/me").status_code == 200


@pytest.mark.parametrize(
    "setting,value",
    [
        ("SETTINGS_MODULE", "config.settings.production"),
        ("DEBUG", False),
        ("EMAIL_DELIVERY_MODE", "resend"),
    ],
)
def test_local_login_never_seeds_outside_private_development(settings, tmp_path, setting, value):
    enable_local(settings, tmp_path)
    setattr(settings, setting, value)
    if setting != "SETTINGS_MODULE":
        settings.SETTINGS_MODULE = "config.settings.development"
    assert ensure_local_login() is None
    assert not User.objects.exists()
    assert not (tmp_path / ".local").exists()


def test_local_login_preserves_a_changed_account_password(settings, tmp_path):
    enable_local(settings, tmp_path)
    credentials = ensure_local_login()
    owner = User.objects.get(pk=credentials["userId"])
    owner.set_password("ChangedLocally#4279")
    owner.save(update_fields=["password"])
    ensure_local_login()
    owner.refresh_from_db()
    assert owner.check_password("ChangedLocally#4279")
