# Validation record

Checked on 9 October 2026 against this change set, using Node 24.19.0 in the local environment. CI is configured for Node 22; its hosted result is separate from the local results below.

| Check | Observed result |
| --- | --- |
| Jest | 3 suites, 9 tests passed |
| Production build with `CI=true` | Compiled successfully |
| Chromium 134 production-build smoke test | Demo entry, dashboard, customer/invoice navigation and sign-out passed; no uncaught page errors |
| Mobile viewport, 390 × 844 | No document-level horizontal overflow on the overview page |
| Desktop viewport, 1440 × 1000 | Dashboard and invoice screenshots captured from the actual build |
| Demo data-service check | Entry, billing, price snapshots, deletion protection, storage isolation and reset passed |

The build reports approximately 317.5 KB of gzip JavaScript across its three chunks and 5.73 KB gzip CSS. These are build outputs, not network timings or a Lighthouse score.

Mobile icon links were given explicit accessible names. The chart grid was adjusted after the first mobile run revealed horizontal overflow. A skip-to-content link and named invoice inputs were added. These targeted checks do not constitute a WCAG audit or broad browser certification.

Known toolchain warnings remain for old Browserslist data and legacy dependency peer requirements. No dependency-security audit or public deployment was completed in this validation run.
