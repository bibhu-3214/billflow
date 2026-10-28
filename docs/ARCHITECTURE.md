# Product architecture

Decision record, 28 October 2026. The owner requested the full Perqelle-style upgrade. Development is authorized; purchases and public activation remain deferred.

~~~mermaid
flowchart TD
    Web[Responsive React web] --> API[Django API]
    Native[Expo Android and iPhone candidate] --> API
    API --> Auth[Verified accounts and scoped sessions]
    API --> DB[PostgreSQL records, invoices and audit metadata]
    API --> Mail[Durable account-email outbox]
    Cron[Bounded scheduled command] --> Mail
    Mail --> Resend[Resend after activation]
    Old[Encrypted browser backup] --> Review[Explicit preview and confirmation]
    Review --> API
~~~

The schema has one owner per business, individual catalog/operational JSON records, dedicated invoices with unique number/source constraints, request receipts and metadata audit events. It avoids whole-workspace overwrite APIs, but is not a fully normalized accounting ledger. Team memberships are not exposed.

Every mutation locks the business inside a PostgreSQL transaction. Domain validation, changed records, sequence updates and audit metadata commit together. Request keys are scoped to the business and bound to the canonical request digest; reuse with different content is rejected. Draft and quotation source IDs prevent repeated issuance even after editor revisions change.

Money uses Decimal and integer paise with explicit half-up rounding. Issued snapshots remain unchanged after catalog edits. Payments cannot exceed balance. Full credit/cancellation requires no active payments. A reversal only corrects a record; it does not send a refund.

Browser accounts use HttpOnly sessions, same-origin requests and CSRF. Bootstrap loads server identity before rendering private UI. Unconfigured OAuth buttons are omitted. Native app sessions use SecureStore; expired sessions clear the current private view. Financial writes never fall back to browser storage.

The native candidate implements core connected workflows. Advanced recovery, account controls, statements and printable documents currently open the separately authenticated website. Native provider authentication, app links and signed-device acceptance remain gaps.

Migration is a reviewed transfer into an unchanged empty business. Decryption stays on the device; preview sends plaintext records, never credentials. Validation checks IDs, totals, sequences, correction history, quotation links and operational histories. A digest binds confirmation to the reviewed payload; revision guards reject intervening writes. Incompatible historical totals are rejected rather than silently corrected. Imported history does not prove prior server activity.

Audit events reside in the same database and are not tamper-proof against database operators. Email uses durable jobs, bounded leases, quota reservations and stable provider request keys. Provider acceptance does not establish receipt.

The production container serves the connected SPA and Django from one origin, with WhiteNoise assets and a private managed database. The older Netlify/static deployment applies only to local mode.

References: [Django transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/), [allauth headless](https://docs.allauth.org/en/latest/headless/installation.html), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Render Blueprints](https://render.com/docs/blueprint-spec). These support implementation contracts, not live resource activation.
