"""Wait for the isolated API and connected development client in CI."""
import os
import time
import urllib.error
import urllib.request

origins = ["http://127.0.0.1:3000"]
if built_origin := os.environ.get("BILLFLOW_TEST_BUILT_ORIGIN"):
    origins.append(built_origin.rstrip("/"))
for _ in range(90):
    try:
        for origin in origins:
            with urllib.request.urlopen(origin + "/api/v1/health/ready", timeout=2) as response:
                if response.status != 200:
                    raise urllib.error.URLError("Service not ready")
        break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(1)
else:
    raise SystemExit("Acceptance services did not become ready.")
