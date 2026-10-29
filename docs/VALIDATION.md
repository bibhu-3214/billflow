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


## Premium workspace foundation — 29 October 2026

Workspace navigation, the financial dashboard/action center, interactive month selection, customer lookup, focused sales views and direct invoice actions were validated locally. Routes load lazily with a recoverable page boundary. The connected main entry measured 431,820 bytes versus 715,789 bytes before this change (39.7% smaller); no real-user speed measurement is claimed. Both build modes passed without the earlier large-chunk warning.

Strict type/no-any checks, 140 frontend tests in 35 suites, three tooling checks and thirteen browser cases passed. Browser cases include desktop/tablet/phone financial workflows and premium layouts, empty data, CSRF origin/token boundaries and a deliberately failed built-page download followed by navigation to another working page. CI now starts a connected production preview for that recovery test. Existing account records and running services were preserved; separate disposable services supplied the acceptance data. Remote CI, public deployment, signed native builds, tax suitability and full accounting/payment integrations remain unverified or outside this milestone.

## Tailwind form controls — 29 October 2026

Visible dropdown menus, calendar popovers, file input buttons and inline validation now use Tailwind utilities and shared light/dark tokens. Unstyled Radix Select/Popover provide interaction behavior; DayPicker receives Tailwind class names and loads separately when a calendar opens. Hidden native select controls retain real change/blur events and form validation. Date entry uses local YYYY-MM-DD values, rejects impossible dates and respects minimum/maximum dates. Legacy recipe overrides that removed field padding were corrected.

Strict TypeScript/no-any lint, 157 frontend tests in 37 suites, three tooling checks, both production build modes and all sixteen browser cases passed. Date parsing/formatting tests also passed in Asia/Kolkata and America/Los_Angeles. Desktop, tablet and phone checks cover visible menu styling, bounded scrolling, empty options, selected values, calendar limits, typed invalid dates, nested Escape behavior and restored focus. Screenshots were visually reviewed. Dedicated disposable controls accounts avoid sharing API request limits with financial workflow cases.

The actual local checkout independently passed strict checks, all 157 frontend tests and its connected production build. The already-running app passed a browser smoke check for sign-in, dropdowns, input spacing and calendar/dialog focus without changing business records. Its frontend and API processes were preserved. QA used a separate temporary PostgreSQL database and API/frontend ports.

The connected entry now measures 500,136 bytes (158.08 kB gzip), and Vite reports its 500 kB chunk warning; the calendar is a separate roughly 70 kB lazy chunk. No production speed improvement is claimed for this controls change. Operating-system file choosers and print dialogs remain system UI. React Native styling is unchanged.

## Remaining Tailwind web styling — 29 October 2026

All ten disclosure locations now use a shared Tailwind component with custom chevrons, native Enter/Space interaction and visible focus outlines. Global colour-scheme, font/tap behavior, reduced-motion overrides and quotation print layout use Tailwind utilities through `@apply`. Custom animations are registered in the Tailwind CSS-first theme; CSS keyframe definitions and `@page` dimensions remain configuration, as required by the rendering systems.

Strict TypeScript/no-any checks, 157 frontend tests across 37 suites and three tooling checks passed. Both build modes passed; the existing roughly 500 kB entry-chunk warning remains. Thirteen financial/workspace/print/recovery browser cases passed, followed by all three final responsive controls cases after correcting reduced-motion duration reset and focus outline styling. The final controls checks cover menu/calendar behavior plus disclosure keyboard toggling, chevron rotation, keyboard focus, light/dark appearance and reduced motion at desktop, tablet and phone sizes. Six fictional disclosure screenshots were saved; desktop, tablet and phone samples were visually reviewed. The actual running local checkout also passed a sign-in, dropdown/calendar and disclosure keyboard/focus/reduced-motion smoke check without changing business records.

This pass changes the web application. Dynamic chart/tooltip geometry, library-owned positioning/scrollbar rules, jsPDF document rendering and operating-system dialogs retain their required mechanisms. The separate React Native app has not been migrated to NativeWind. Existing private records, uncommitted work and running development services were preserved; browser financial fixtures used a disposable PostgreSQL database and separate service ports.
