from django.core.exceptions import ImproperlyConfigured

from .base import *

if (
    len(SECRET_KEY) < 50
    or len(set(SECRET_KEY)) < 8
    or SECRET_KEY.startswith("billflow-development")
    or not ALLOWED_HOSTS
    or "*" in ALLOWED_HOSTS
    or not APP_ORIGIN.startswith("https://")
):
    raise ImproperlyConfigured(
        "Production requires a strong secret, explicit hosts and HTTPS APP_ORIGIN."
    )
if (
    EMAIL_DELIVERY_MODE != "resend"
    or not RESEND_API_KEY
    or DEFAULT_FROM_EMAIL.endswith("@localhost")
):
    raise ImproperlyConfigured(
        "Production requires configured verification and recovery email delivery."
    )
if not SUPPORT_EMAIL:
    raise ImproperlyConfigured("Production requires a real support mailbox address.")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Host-only cookies cannot be planted by a sibling subdomain.
SESSION_COOKIE_NAME = "__Host-billflow_session"
CSRF_COOKIE_NAME = "__Host-billflow_csrf"
CSRF_COOKIE_HTTPONLY = True
