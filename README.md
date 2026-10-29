# BillFlow

**Your business, in focus.** Customers, catalog, invoices and collections in one considered workspace.

BillFlow has a responsive workspace with desktop navigation, a financial overview, interactive invoice trends, customer lookup and focused sales views. It has a strict TypeScript/React frontend and is being upgraded into a customer product using the same development-first approach as Perqelle: a responsive web app, Django/PostgreSQL backend and an Android/iPhone candidate.

**Status: local development; not publicly released.** Hosting, domains, live email, support mailboxes and store accounts have not been activated. See [Delivery status](docs/DELIVERY-STATUS.md) for evidence and outstanding work.

## What you can do

| Workflow | Behavior |
| --- | --- |
| Prepare sales | Search items by name/SKU/category, enter quantities, save drafts/templates and prepare quotations |
| Issue invoices | Domestic GST, financial-year numbers, discounts and immutable party/price snapshots |
| Track collections | Partial/full payment records, receivables, statements, reversals, cancellation and full credit |
| Run the day | Customer/catalog search, manual whole-unit stock counts, customer follow-ups and outcome history |
| Recover records | Encrypted snapshots and an explicit transfer into an empty connected business |
| Control access | Verified accounts, email recovery, scoped server authorization and confirmed account deletion |

Invoice and quotation editors support keyboard item entry: search a name, SKU or category, choose a quantity and press Enter for a unique match. Keyboard-style scanners can enter a saved SKU; duplicate codes require an explicit product choice. See [retail upgrades](docs/PRODUCT-UPGRADES.md).

Payments are manual records. BillFlow does not connect to banks, move money, automatically contact customers or file taxes. Invoices do not reserve or deduct stock. Team roles, purchasing/expenses, fractional units, valuation, e-invoice registration and e-way bills are outside this release. Tax applicability and classification require professional review.

PDF invoices, credit notes and statements use MIT-licensed jsPDF/AutoTable and embedded Noto Sans. See [PDF limits](docs/PDF_EXPORTS.md) and [notices](public/THIRD_PARTY_NOTICES.txt).

## Two explicit modes

| Mode | Storage and identity | Intended use |
| --- | --- | --- |
| Local | Existing encrypted browser workspace and isolated tab demo | Demonstration and access to existing local records |
| Connected | Verified Django accounts and PostgreSQL | Development candidate for the customer product |

Set REACT_APP_ACCOUNT_BACKEND=django for connected mode; leave it unset for the retained local build. Changing mode never uploads records. Network failures never fall back to local financial writes.

The backend applies domain validation, transactional numbering, record revisions and request identities. The schema stores catalog/operational records individually as typed JSON, with separate invoice, receipt and audit tables. This is not a fully normalized accounting ledger or tamper-proof history.

## Frontend development

All application code and frontend tests in `src/` use `.ts`/`.tsx`. Run `yarn check` (or `npm run check`) for strict types and no-any lint checks, `yarn test --runInBand` for tests, and `yarn build` or `yarn build:connected` for a checked production build. The same no-any policy applies to frontend tests; native lint is available through `yarn lint:native` after installing native dependencies. Node orchestration/test configuration remains `.mjs`/`.cjs`. See [TypeScript development](docs/TYPESCRIPT.md).

## Run locally

For the connected web app, API, private PostgreSQL and automatic local email capture:

~~~sh
yarn setup:local
yarn dev:local
~~~

You can also start the same stack with `npm run dev` or `yarn dev`.

The connected development stack creates a verified local test account and prefills the sign-in form. Its generated credentials persist privately in the ignored `api/.local/local-login.json` file; they are excluded from production builds. Other accounts and registration remain available.

Open http://127.0.0.1:3000. Create an account and open its verification link from the private JSON file in api/.local/mail/. Captured email is not sent externally. Data persists in api/.local/postgres between restarts. Stop the stack with Ctrl+C.

The separate commands below remain available for individual services and the local-only browser demo.

Requires Node 22/24, Yarn 1.22.22 and Python 3.13. The web app now uses Vite 7 and Jest 30; the React interface uses Tailwind CSS 4, accessible Radix dialogs and Lucide icons. See [Tailwind development](docs/TAILWIND.md).

~~~sh
yarn install --frozen-lockfile
yarn start
~~~

For connected development:

~~~sh
python3 -m venv api/.venv
api/.venv/bin/pip install -r api/requirements-dev.txt
docker compose up -d db
cd api
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 127.0.0.1:8001
~~~

In another terminal at the repository root:

~~~sh
REACT_APP_ACCOUNT_BACKEND=django yarn start
~~~

Development email is captured through the durable outbox. Run python manage.py deliver_mail using the API virtual environment; private messages appear under api/.local/mail/. Verification is mandatory before financial APIs can be used. Django does not automatically source api/.env.example.

The [API guide](api/README.md) includes a private PostgreSQL runner for development without Docker.

## Checks

~~~sh
yarn test --watchAll=false --runInBand
yarn test:tooling
yarn build
yarn build:connected
cd api
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/python scripts/with_local_postgres.py --temporary -- -m pytest -q
~~~

[Browser acceptance](docs/VALIDATION.md) uses actual PostgreSQL. Native type checks, transport tests and JavaScript exports run separately in [native/](native/README.md); passing exports do not prove signed-binary or physical-device behavior.

## Moving existing records

Export an encrypted backup from the local build. Sign into an empty connected business and open Settings. Enter the backup password, preview counts and confirm IMPORT. Decryption stays on the device; preview sends plaintext records for server validation. Credentials are never transferred. Existing records are never merged or replaced.

Stop issuing from the old local copy after cutover: its independent sequence can overlap. Keep the original backup and test recovery. Connected exports use a separate backup password; account recovery cannot decrypt that backup.

## Product records

- [Architecture](docs/ARCHITECTURE.md): identity, transactions and persistence.
- [Delivery status](docs/DELIVERY-STATUS.md): implemented scope and remaining gaps.
- [Release preparation](docs/DEPLOYMENT.md): providers, recovery and launch checks.
- [Local workflow reference](docs/LOCAL-WORKFLOWS.md): detailed retained browser behavior.

The first public release is free. Subscriptions, hosting and domain purchases remain deferred until development and release review are complete.
