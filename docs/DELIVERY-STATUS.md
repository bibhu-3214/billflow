# Delivery status

28 October 2026. Development implementation on top of GitHub master d72cd1c. This is a local candidate, not a public launch.

| Area | Implemented | Remaining acceptance |
| --- | --- | --- |
| Web experience | Retained responsive billing UI; connected identity, recovery, Help, explicit backup/import, account controls and accessible form labels | Wider browser/accessibility and business-pilot acceptance |
| Web tooling | Vite 7 and Jest 30 replace CRA/CRACO; JSX files use .jsx; obsolete compatibility patches removed | UI library maintenance and performance tuning |
| Accounts | Django/allauth, mandatory verification, password recovery, cookie/CSRF browser sessions, app sessions, scoped export/deletion and conditional web Google/Apple configuration | Real OAuth credentials, delivery, linking and mailbox tests |
| Billing | PostgreSQL business locks, server validation, invoice/source uniqueness, request receipts, immutable snapshots and exact paise | Professional tax review, load acceptance and broader accounting scope |
| Operations | Drafts, quotations/conversion, templates, manual stock and customer follow-up history | Team roles, purchasing/expenses, valuation and fractional stock are outside this release |
| Recovery | Device-side encrypted export/decryption; preview/digest/revision-confirmed empty-business import; actual database restore rehearsal | Managed-host restore, retention policy and hosted rollback |
| Documents | MIT jsPDF/AutoTable and embedded Noto Sans replace Kendo; long invoice/credit/statement cases verified | Supported-script limits and business-specific document acceptance |
| Android/iPhone | Expo candidate with secure sessions and core connected workflows; both JavaScript exports pass | Native social auth/app links, full native-only parity, signed binaries and physical-device acceptance |
| Hosting | Same-origin Docker/Render preparation and scheduled account-mail configuration | Docker execution, live resource/schema validation, ownership, actual accounts, domain and deployment |
| Quality | Local test suites, dependency audits and CI definitions | Remote CI and independent security acceptance |

The first public release is free. No subscription checkout, hosting purchase, domain purchase, developer enrollment, public deployment, provider activation or customer communication was performed.

The native candidate opens advanced recovery/account controls, full statements and printable documents on the separately authenticated website. It requires a network connection for writes. These limitations are explicit in native/README.md and must not be marketed as full native parity.

The data model uses individually stored JSON catalog/operational records and separate invoice/receipt/audit tables. Ownership is server-enforced, but the schema is not a fully normalized accounting ledger and the audit history is not tamper-proof against database operators.

See [Validation](VALIDATION.md) for current evidence and [Release preparation](DEPLOYMENT.md) for remaining gates.
