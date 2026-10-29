# Validation record

28 October 2026, local development candidate based on d72cd1c. Checks were run against the modified source, including new untracked files. No previous repository security-scan result is carried forward.

| Check | Observed result |
| --- | --- |
| Web/domain/component tests | 28 suites, 110 tests passed on Jest 30 |
| Tooling | International-host DOM regression passed |
| PostgreSQL/API | 39 tests passed on real disposable PostgreSQL, including shared calculation fixtures, local test-account reuse and production guards |
| Concurrency/retry | Eight simultaneous issuances yielded unique consecutive numbers; source conversion and request-key retries did not duplicate invoices |
| Failure paths | Injected database failure rolled back numbering and draft consumption; stale editors, overpayments, incorrect tax, ownership and missing business identity were rejected |
| Account boundaries | Verification, recovery, session revocation, CSRF and owner scoping passed; logout clears every private UI collection and late responses are discarded |
| Browser acceptance | Desktop 1440×1000, tablet 820×1180 and phone 390×844 passed sign-in, save/reload/resume/issue, payment, encrypted export, Help and server sign-out |
| Web builds | Local and connected Vite production builds passed |
| Production serving contract | Built SPA and generated JS/CSS served through Django/WhiteNoise; missing asset and unknown API paths remain 404 |
| Native | Type check and two transport tests passed; Android and iPhone JavaScript exports passed |
| Database recovery | Actual pg_dump/pg_restore preserved invoice identity/amounts and continued with the next number |
| PDF QA | Nine fictional cases passed text/totals/header/page-number checks; invoice, credit and statement layouts rendered and visually reviewed |
| Python lint/format | Ruff checks passed |
| Web dependency audit | No high/critical findings; two low advisory paths remain |
| Native dependency audit | No high/critical findings; twenty low advisory paths remain |
| Python pinned dependency audit | No known findings after updating Django REST Framework to 3.18.2 |

Audit results are registry snapshots, not a source-security assessment or a promise about future advisories. The native Zod override is validated by the CLI export/type/transport checks, not signed-device execution.

The web build currently warns about a large initial chunk. Screenshots under output/ show the connected invoice/settings views. Synthetic encrypted backups, audit JSON and PDF fixtures are local QA output, not customer data and not tracked source.

## Reproduce browser acceptance

Start the connected web client, then run the isolated API fixture service:

~~~sh
REACT_APP_ACCOUNT_BACKEND=django yarn start
~~~

In api/:

~~~sh
.venv/bin/python scripts/with_local_postgres.py --temporary -- -m scripts.serve_acceptance
~~~

At the repository root:

~~~sh
yarn playwright install chromium --only-shell
yarn test:browser
~~~

Each viewport uses a different verified synthetic account. The fixture script refuses non-test settings. A restrictive host sandbox may need local execution permission for PostgreSQL shared memory and browser processes.

## Reproduce recovery and documents

~~~sh
cd api
.venv/bin/python scripts/with_local_postgres.py --temporary -- -m scripts.restore_drill
~~~

At the repository root:

~~~sh
yarn pdf:samples
api/.venv/bin/pip install -r api/requirements-pdf-checks.txt
api/.venv/bin/python scripts/verify-pdfs.py output/pdf
~~~

## Unverified release work

Docker execution and hosted Render schema/resource behavior were not run here because Docker is unavailable. The committed GitHub jobs have not run remotely. Real Resend/OAuth/mailboxes, managed-host restore and rollback, signed mobile binaries, physical devices, native provider links, statutory suitability and an independent security review remain outstanding.

The historical local-only evidence is retained separately in VALIDATION-LOCAL-2026-10-09.md.

## TypeScript migration and focused hardening follow-up — 28 October 2026

The browser application and all frontend tests now use strict TypeScript (102 existing modules/tests renamed), with shared domain/data contracts and typed Redux hooks/actions. JavaScript Node configuration and orchestration remain intentional. Separate application and test type checks are wired into build/CI, and the Docker build includes the TypeScript configs. The Django code remains Python.

Validation on the modified source: strict typecheck; 120 frontend tests across 30 suites; one tooling test; local and connected production bundles; nine PDF fixtures with text/totals/page/image checks; and connected browser workflows at desktop/tablet/phone sizes. The existing large initial-bundle warning remains.

The long-running deep security scan was cancelled at the user's request and replaced with focused review; its partial output is not a completed scan. Focused hardening tests passed: 53 PostgreSQL/API tests, Python lint/format checks, migration consistency, synthetic production deployment checks, security headers/cookies, harmless Vite private-file sentinels, cross-tab sign-out, and production-built form/theme/font rendering without CSP violations. These checks do not establish whether a historical compromise occurred. Real hosting/ingress/email/OAuth acceptance remains outstanding. The user's running development stack was preserved; backend changes/migrations activate on its next restart.

## Tailwind migration — 29 October 2026

The web interface now uses Tailwind CSS 4.3.3 through its Vite plugin, typed shared utility recipes, native form/table primitives, Radix dialogs and Lucide icons. Material UI/core/icons, the JSS theme and SweetAlert have been removed. React Native styling is unchanged. See [Tailwind development](TAILWIND.md).

The modified source passed strict TypeScript/no-any lint, 121 frontend tests across 31 suites, all three tooling policy checks, local and connected production builds, and nine PDF fixture checks. Six connected browser cases cover desktop/tablet/phone financial flows, theme persistence, bounded layouts, focus trapping/restoration, nested discard prompts and quotation printing. An immediate-print opacity regression was corrected by disabling animations in print media; the resulting quotation PDF was rendered and inspected. Test services used separate ports and disposable PostgreSQL; the existing development stack and private records were preserved.

The existing large JavaScript chunk warning remains. These checks establish local frontend behavior, not hosted deployment, native-device execution or a new security audit.
