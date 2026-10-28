import pytest
from allauth.account.models import EmailAddress
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture(autouse=True)
def clear_limits(settings):
    settings.EMAIL_BACKEND = "mail.backend.OutboxBackend"
    cache.clear()


@pytest.fixture
def user(db):
    user = User.objects.create_user(
        "owner@example.test",
        "PrivatePassword#2581",
        display_name="Owner",
        business_name="North Studio",
        business_address="Mumbai",
    )
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return user


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client
