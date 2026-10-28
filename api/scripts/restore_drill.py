"""Rehearse actual pg_dump/pg_restore using a disposable local PostgreSQL cluster."""

import os
import subprocess
import sys
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory

import django
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
    django.setup()
    from django.conf import settings
    from django.core.management import call_command
    from django.db import connections

    from accounts.models import User
    from billing.models import Invoice
    from billing.repository import execute
    from billing.rules import today

    if settings.SETTINGS_MODULE != "config.settings.test" or not settings.DEBUG:
        raise SystemExit("Restore rehearsal requires isolated test settings.")
    params = conninfo_to_dict(os.environ["DATABASE_URL"])
    if not params.get("host", "").startswith("/") or params.get("password"):
        raise SystemExit("Use the private temporary PostgreSQL runner for this rehearsal.")
    import embedded_postgres

    binaries = Path(embedded_postgres.__file__).parent / "pginstall" / "bin"
    call_command("migrate", verbosity=0, interactive=False)
    owner = User.objects.create_user(
        "restore-drill@example.test",
        "DisposableOnly#4827",
        business_name="Restore drill",
        business_address="Mumbai",
    )

    def command(action, *args):
        return execute(owner, action, list(args), uuid.uuid4())

    customer = command(
        "addCustomer",
        {"name": "Rehearsal buyer", "email": "buyer@example.test", "mobile": "9876543210"},
    )
    product = command("addProduct", {"name": "Rehearsal item", "price": 250})
    values = {
        "date": today(),
        "customer": customer["_id"],
        "billingAddress": "Mumbai",
        "lineItems": [{"product": product["_id"], "quantity": 1}],
    }
    first = command("addBill", values)
    target = "billflow_restore_" + uuid.uuid4().hex[:12]
    target_url = make_conninfo(**{**params, "dbname": target})
    with TemporaryDirectory(prefix="billflow-restore-") as folder:
        dump = Path(folder) / "snapshot.dump"
        connections.close_all()
        subprocess.run(
            [
                str(binaries / "pg_dump"),
                "--format=custom",
                "--file",
                str(dump),
                "--dbname",
                os.environ["DATABASE_URL"],
            ],
            check=True,
            capture_output=True,
        )
        with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as admin:
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target)))
        try:
            subprocess.run(
                [
                    str(binaries / "pg_restore"),
                    "--exit-on-error",
                    "--no-owner",
                    "--dbname",
                    target_url,
                    str(dump),
                ],
                check=True,
                capture_output=True,
            )
            connection = connections["default"]
            original = connection.settings_dict["NAME"]
            connection.settings_dict["NAME"] = target
            try:
                recovered = Invoice.objects.get(key=first["_id"])
                assert recovered.total_paise == 25000
                assert recovered.data["invoiceNumber"] == first["invoiceNumber"]
                second = command("addBill", values)
                assert second["invoiceNumber"].endswith("000002")
                assert Invoice.objects.count() == 2
                print(
                    "PASS: database dump/restoration, invoice identity, exact amounts and next-number continuity."
                )
            finally:
                connections.close_all()
                connection.settings_dict["NAME"] = original
        finally:
            with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as admin:
                admin.execute(
                    sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(target))
                )
    return 0


if __name__ == "__main__":
    sys.exit(main())
