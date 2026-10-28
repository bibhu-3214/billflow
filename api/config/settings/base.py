import os
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from django.core.validators import validate_email

BASE_DIR = Path(__file__).resolve().parents[2]
DEBUG = False
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
APP_ORIGIN = os.environ.get("APP_ORIGIN", "http://127.0.0.1:3000").rstrip("/")
origin = urlsplit(APP_ORIGIN)
if (
    origin.scheme not in {"http", "https"}
    or not origin.netloc
    or any([origin.username, origin.password, origin.path, origin.query, origin.fragment])
):
    raise ImproperlyConfigured("APP_ORIGIN must be a canonical HTTP(S) origin.")
ALLOWED_HOSTS = [s for s in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if s]
CSRF_TRUSTED_ORIGINS = [APP_ORIGIN]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
    "allauth.headless",
    "accounts",
    "billing",
    "mail",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "billing.middleware.PrivateResponses",
]
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
DATABASES = {
    "default": dj_database_url.parse(
        os.environ.get(
            "DATABASE_URL", "postgresql://billflow:local-development-only@127.0.0.1:5432/billflow"
        ),
        conn_max_age=60,
        conn_health_checks=True,
    )
}
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("BillFlow requires PostgreSQL; no SQLite fallback.")
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_EMAIL_SUBJECT_PREFIX = "[BillFlow] "
ACCOUNT_PREVENT_ENUMERATION = True
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = False
ACCOUNT_LOGIN_ON_PASSWORD_RESET = False
ACCOUNT_LOGOUT_ON_PASSWORD_CHANGE = True
ACCOUNT_ADAPTER = "accounts.adapters.AccountAdapter"
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = False
SOCIALACCOUNT_LOGIN_ON_GET = False
HEADLESS_ONLY = True
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": APP_ORIGIN + "/account?verify={key}",
    "account_reset_password": APP_ORIGIN + "/account?reset=1",
    "account_reset_password_from_key": APP_ORIGIN + "/account?resetKey={key}",
    "account_signup": APP_ORIGIN + "/register",
    "socialaccount_login_error": APP_ORIGIN + "/account?providerError=1",
}
SOCIALACCOUNT_PROVIDERS = {}


def credentials(*names):
    values = [os.environ.get(n, "").strip() for n in names]
    if any(values) and not all(values):
        raise ImproperlyConfigured("Incomplete provider credentials: " + ", ".join(names))
    return values if all(values) else None


if google := credentials("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"):
    SOCIALACCOUNT_PROVIDERS["google"] = {
        "APPS": [{"client_id": google[0], "secret": google[1], "key": ""}],
        "SCOPE": ["profile", "email"],
        "OAUTH_PKCE_ENABLED": True,
    }
if apple := credentials("APPLE_CLIENT_ID", "APPLE_KEY_ID", "APPLE_TEAM_ID", "APPLE_PRIVATE_KEY"):
    SOCIALACCOUNT_PROVIDERS["apple"] = {
        "APPS": [
            {
                "client_id": apple[0],
                "secret": apple[1],
                "key": apple[2],
                "settings": {"certificate_key": apple[3].replace("\\n", "\n")},
            }
        ]
    }
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.MobileSessionAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["accounts.permissions.VerifiedAccount"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"user": "120/minute"},
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "billing_cacheentry",
    }
}
EMAIL_BACKEND = "mail.backend.OutboxBackend"
EMAIL_DELIVERY_MODE = os.environ.get("EMAIL_DELIVERY_MODE", "capture")
DEFAULT_FROM_EMAIL = os.environ.get("EMAIL_FROM", "accounts@localhost")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_BUDGET_DAILY = int(os.environ.get("EMAIL_BUDGET_DAILY", "90"))
EMAIL_BUDGET_MONTHLY = int(os.environ.get("EMAIL_BUDGET_MONTHLY", "2800"))
if (
    EMAIL_DELIVERY_MODE not in {"capture", "resend"}
    or not 1 <= EMAIL_BUDGET_DAILY <= EMAIL_BUDGET_MONTHLY
):
    raise ImproperlyConfigured("Invalid email mode or budgets.")
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "").strip()
if SUPPORT_EMAIL:
    validate_email(SUPPORT_EMAIL)
SESSION_COOKIE_NAME = "billflow_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 8 * 60 * 60
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_FAILURE_VIEW = "billing.views.csrf_failure"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
DATA_UPLOAD_MAX_MEMORY_SIZE = 24 * 1024 * 1024
USE_TZ = True
TIME_ZONE = "Asia/Kolkata"
LANGUAGE_CODE = "en-in"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / ".local" / "static"
WEB_BUILD = BASE_DIR.parent / "build"
WHITENOISE_ROOT = WEB_BUILD
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "loggers": {
        name: {"handlers": ["null"], "propagate": False}
        for name in ["django.server", "django.request"]
    },
}
