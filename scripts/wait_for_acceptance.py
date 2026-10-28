"""Wait for the isolated API and connected development client in CI."""
import time
import urllib.error
import urllib.request

for _ in range(90):
    try:
        with urllib.request.urlopen("http://127.0.0.1:3000/api/v1/health/ready", timeout=2) as response:
            if response.status == 200:
                break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(1)
else:
    raise SystemExit("Acceptance services did not become ready.")
