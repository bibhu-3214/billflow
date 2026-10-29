# Release preparation

Development first. Applying render.yaml, buying a domain, enrolling in stores and activating paid services remain deferred until development acceptance and concrete resource review.

## Prepared configuration

api/Dockerfile builds the connected React app and serves it with Django/Gunicorn/WhiteNoise on one origin. Do not publish connected mode on a separate static origin without a reviewed proxy/auth design. Existing netlify.toml is for the local demo.

render.yaml proposes a paid web service, private PostgreSQL and a scheduled account-email worker. Validate plans, region and billing at activation. This file does not establish hosted resources. Secrets stay external; migrations run before deployment; auto-deployment is disabled.

## Development acceptance

1. Run web/domain/tooling checks, both builds, Python checks and real PostgreSQL tests.
2. Exercise connected flows on desktop/tablet/phone: reload, drafts, invoice/payment, backup and server logout.
3. Inspect long PDF invoices, credit notes, statements, logos, unsupported-glyph handling and monetary text.
4. Run native type/transport checks and both JavaScript exports. Complete parity gaps and signed-device acceptance before mobile release.
5. Rehearse imports, database restore, rollback and number continuity in isolated data. Local recovery does not establish managed-host recovery.

## Owner-controlled setup

After development, settle brand/domain clearance and review exact resource charges. Configure HTTPS origin/hosts, a strong Django secret, verified Resend sender/domain, a receiving/reply-capable support mailbox and optional Google/Apple credentials in owner-controlled accounts.

Never commit credentials or put them in public React/Expo variables. Restrict database external access; separate development/test/staging/production identities. Review actual proxy trust, edge rate limits and content-free operational alerts.

## Hosted acceptance and rollback

Verify HTTPS/cookies, real verification/reset delivery, quotas, worker liveness, OAuth identity/linking, account isolation, export/deletion, backup restoration, support receipt/reply and recovery/rollback.

Production settings reject capture-only email, absent provider/support configuration, weak secrets and non-HTTPS origins. Provider acceptance does not prove inbox receipt.

For rollback, stop writes/jobs, preserve a verified database snapshot and restore a compatible app/database pair. Do not run an old client against an incompatible schema or re-enable independent local invoice numbering after cutover.

The first release is free. Team authorization, statutory retention/deletion, staff/database-operator controls, independent audit integrity and load acceptance still need business-specific decisions.

No hosting, purchase, provider activation, public deployment, signing, store submission or customer communication was performed.

## Security configuration added for local review

Production sends CSP, Permissions-Policy and same-origin resource headers. Sessions and CSRF use secure host-only cookies. Development retains local HTTP support; the optional generated login prefill is restricted to connected Vite development and never enabled by production builds. Vite denies backend/runtime/cache files, and Docker excludes local runtime directories and environment files.

`DJANGO_TRUSTED_PROXY_COUNT` defaults to `0` (direct peer only), accepts 0–4, and must match a verified ingress topology before launch. The trusted edge must strip client-supplied forwarding headers and set the real chain. Signup and password recovery are limited separately; unknown-account recovery emails are disabled. Real ingress, edge limits, provider credentials, email delivery and OAuth remain deployment acceptance work.

The durable mail outbox limits pending jobs, recipient frequency and origin frequency. Daily/monthly delivery budgets reserve separate security, recovery and verification lanes. Pending verification/recovery jobs coalesce only while account credential/login state is unchanged. The additive `mail.0002_delivery_admission` migration must run with the new backend code; the local startup script migrates before serving. A backend already running with `--noreload` loads these changes only on its next restart.

Imports reject oversized nested collections and excessive aggregate work before copying records or catalog lookups. Workspace JSON is limited to 64 MiB. Command history is limited to 10,000 receipts / 64 MiB of response JSON, with a 512 KiB maximum individual response. Existing request-key replays are checked before capacity limits and remain exact; failed new commands roll back their business changes and audit entries. Hitting capacity requires a reviewed support/storage policy: never delete request receipts to bypass the limit, because retries rely on them. Invoice payment history is capped at 1,000 entries without discarding prior records.
