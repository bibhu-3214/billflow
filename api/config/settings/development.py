from .base import *

DEBUG = True
SECRET_KEY = SECRET_KEY or "billflow-development-only-secret-never-deploy-this-value"
ALLOWED_HOSTS = ALLOWED_HOSTS or ["localhost", "127.0.0.1", "[::1]"]
MIDDLEWARE = [m for m in MIDDLEWARE if m != "whitenoise.middleware.WhiteNoiseMiddleware"]
