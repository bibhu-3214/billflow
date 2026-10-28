# BillFlow Android / iPhone candidate

A connected React Native/Expo client using the same Django records as the web app. This is source/JavaScript-export preparation, not a signed or store-ready release.

~~~sh
npm ci
npm run typecheck
npm test
EXPO_PUBLIC_API_ORIGIN=https://your-service.example npm start
npm run bundle
~~~

Only a public service origin is bundled. Production requires HTTPS, an owned app identifier and EAS project. Unconfigured builds show an honest setup state. Development permits loopback/emulator cleartext origins only.

| Workflow | Native candidate |
| --- | --- |
| Accounts | Email sign-up/sign-in, verification/reset keys, recovery, secured device sessions and server logout |
| Today | Outstanding/overdue amounts, collections, customer conversations and low counted stock |
| Sales | Invoice totals review/payment/corrections, drafts, quotation decisions/conversion and templates |
| Customers | CRUD, customer balances and follow-up outcomes |
| Products | CRUD, catalog metadata and manual whole-unit stock |
| Settings | Identity, tax defaults and payment instructions |
| Backup/import, deletion, printable documents and full statements | Separately authenticated website |
| Native Google/Apple authentication and verified app links | Pending implementation/provider/device acceptance |
| Offline issuance/background sync | Not implemented; writes require the server |

The interface follows system appearance, safe areas, scrollable editors, readable labels and touch targets. Issuance totals come from the backend before confirmation. Revisions and source IDs remain authoritative on the server.

Tokens use SecureStore with iOS device-only accessibility; Android backup is disabled. Credentials never appear in browser links. Session expiry clears authentication and loaded records. Lost-response request identities persist for this process; draft/quotation IDs are the durable issuance guard.

Before release, exercise signed builds on actual Android/iPhone devices, SecureStore failures, keyboard/safe-area/text scaling, interruptions/restarts, two-account isolation, native provider callbacks, app links, privacy declarations and store acceptance. Passing exports do not establish these behaviors.
