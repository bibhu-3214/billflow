"""Run the persistent local API and captured account-email worker together."""

import io
import os
import signal
import subprocess
import sys
import time

import django


def main():
    django.setup()
    from django.conf import settings
    from django.core.management import call_command
    from django.db import close_old_connections

    database = settings.DATABASES["default"]
    socket_host = database["HOST"] or database.get("OPTIONS", {}).get("host", "")
    if (
        settings.SETTINGS_MODULE != "config.settings.development"
        or not settings.DEBUG
        or settings.EMAIL_DELIVERY_MODE != "capture"
        or not socket_host.startswith("/")
    ):
        raise SystemExit("Use yarn dev:local with private local PostgreSQL and capture-only email.")
    port = int(os.environ.get("BILLFLOW_API_PORT", "8001"))
    if not 1024 <= port <= 65535:
        raise SystemExit("Invalid local API port.")
    call_command("migrate", verbosity=0, interactive=False)
    from scripts.local_login import ensure_local_login

    ensure_local_login()

    def terminate(signum, frame):
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, terminate)
    server = subprocess.Popen(
        [sys.executable, "manage.py", "runserver", "127.0.0.1:" + str(port), "--noreload"],
        cwd=settings.BASE_DIR,
    )
    try:
        while server.poll() is None:
            close_old_connections()
            call_command("deliver_mail", limit=20, stdout=io.StringIO())
            time.sleep(1)
        return server.returncode
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        close_old_connections()


if __name__ == "__main__":
    sys.exit(main())
