# BillFlow API

Python 3.13, Django 5.2 LTS, Django REST Framework, django-allauth and PostgreSQL. Exact dependencies are committed.

Run migrations before starting the API. Default database settings match root compose.yaml. To use private PostgreSQL without Docker:

~~~sh
.venv/bin/pip install -r requirements-local.txt
.venv/bin/python scripts/with_local_postgres.py -- manage.py migrate
.venv/bin/python scripts/with_local_postgres.py -- manage.py runserver 127.0.0.1:8001 --noreload
~~~

The persistent runner locks .local/postgres. Stop the server before another persistent command. Tests use a disposable cluster:

~~~sh
.venv/bin/python scripts/with_local_postgres.py --temporary -- -m pytest -q
~~~

PostgreSQL shared memory may require execution outside a restrictive host sandbox. There is no SQLite fallback.

## Contracts

| Endpoint | Contract |
| --- | --- |
| GET /api/v1/config | CSRF token, configured support address and enabled providers; no secrets |
| /_allauth/browser/v1/ | Cookie/CSRF email/password/provider flows |
| /_allauth/app/v1/ | App sessions, authenticated using X-Session-Token |
| GET /api/v1/me | Verified account identity |
| GET /api/v1/workspace | Consistent private export, billflow-workspace version 1 |
| POST /api/v1/actions/operation | args array preserving frontend methods; writes require UUID Idempotency-Key |
| POST /api/v1/invoices/preview | Authoritative totals without reserving numbers |
| POST /api/v1/import/preview | Validate transfer; return digest, counts and current revision |
| POST /api/v1/import/commit | Same payload/digest/revision plus confirmation IMPORT; unchanged empty business only |
| POST /api/v1/account/delete | Current password plus confirmation DELETE; removes this account/business only |

Private responses use no-store. Browser mutations require CSRF. All financial endpoints require verified ownership. Passwords, tokens and private records must not appear in access logs.

Account emails persist in mail.Delivery. The bounded deliver_mail command claims leases, reserves daily/monthly attempt quotas, retries failures and uses stable provider idempotency keys. Captured private development mail is not delivery evidence. Production requires real provider configuration and a running worker.

Storage caps: 10,000 records per catalog/financial collection; 200 drafts/quotations/templates; 1,000 tracked products with 200 movements each; 500 customer tasks with 100 events each. History limits fail explicitly. A business lock favors correctness over concurrent-write throughput; team roles, scalable pagination and independent audit integrity remain future work.

Each invoice amount is capped at INR 1,000,000,000,000 to retain exact paise at the JSON/browser boundary. Shared Python/web fixtures cover decimal price, component rounding, discount, state and unknown-rate behavior.
