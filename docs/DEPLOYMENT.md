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
