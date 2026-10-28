"""Check the built SPA and assets through Django/WhiteNoise without live hosting."""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.test"
import django

django.setup()
from django.conf import settings
from django.test import Client, override_settings

middleware = list(settings.MIDDLEWARE)
middleware.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
with override_settings(MIDDLEWARE=middleware):
    client = Client()
    response = client.get("/login")
    assert response.status_code == 200
    html = b"".join(response.streaming_content).decode()
    paths = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
    assert len(paths) >= 2
    for path in paths:
        result = client.get(path)
        assert result.status_code == 200, path
        assert "text/html" not in result["Content-Type"], path
        result.close()
    for path in ["/api/not-a-route", "/assets/missing.js", "/fonts/missing.ttf"]:
        assert client.get(path).status_code == 404, path
print("PASS: same-origin built SPA, generated JS/CSS assets and missing-asset/API boundaries.")
