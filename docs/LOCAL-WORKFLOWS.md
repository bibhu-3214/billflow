> Historical local-mode reference, retained from the pre-platform app. Current build commands and connected behavior are documented in README.md and api/README.md.

# BillFlow

**A secure, frontend-only billing workspace for managing customers, products, and invoices.**

BillFlow brings the core billing workflow into one focused dashboard. Create a local business workspace, maintain a searchable customer and product catalog, generate invoices, monitor revenue, and export polished PDFs—all without configuring an API or database.

> [!IMPORTANT]
> BillFlow stores its data in the current browser. It is designed for demonstrations, prototypes, and personal local use—not for production financial or customer data.

## Highlights

| Area | Capabilities |
| --- | --- |
| Overview | Revenue summary, operational metrics, recent activity, and a six-month sales chart |
| Customers | Create, search, update, and remove customer records |
| Products | Maintain a searchable catalog with names and prices |
| Invoices | Build line-item invoices, calculate totals, review history, and download A4 PDFs |
| Experience | Content-sized dialogs, sectioned editors, live invoice review, responsive surfaces, keyboard navigation and reduced-motion support |
| Data integrity | Prevents customers or products referenced by an invoice from being deleted |

## Indian invoicing workflow

### Daily operations workspace

- **Saved invoice drafts:** save incomplete counter orders, search by internal reference/customer, resume, duplicate or remove with confirmation. Drafts are encrypted, included in backups, and excluded from issued invoice totals and receivables. Resuming reviews current catalog prices; missing customers/products require correction before issuance. Saving does not reserve an invoice number. Issuing consumes the draft atomically; retries reuse the same invoice, and revision checks reject stale editors. Copies use today's invoice date and require a new due date. Up to 200 drafts and 100 items per draft are supported. This is explicit Save draft, not background autosave; navigating away without saving can lose edits. It does not reserve or deduct stock.

- **Customer and catalog studios:** sectioned editors with live previews, inline validation, save-state feedback and unsaved-change confirmation. Failed saves retain your entries. Customer profiles store company/contact details, billing address, state, GSTIN and internal notes; selecting a customer prefills invoice billing defaults. Catalog items support SKU, category and an internal description alongside pricing/tax defaults. Internal notes and descriptions are not printed on invoices.

- **Collections:** receivables aging, balances due in the next seven days, and a queue prioritised by overdue days and outstanding amount. Missing due dates appear in a separate bucket rather than being treated as overdue.
- **Reminder drafts:** review and edit a payment message, then copy it to your chosen channel. BillFlow never sends reminders automatically and does not record a draft as a delivered message.
- **Invoice workspace:** status counts, customer/number search, issue-date range, due-date/balance sorting, pagination and filtered balance totals.
- **Customer accounts:** click a customer name to see lifetime invoiced value, outstanding/overdue balances, invoice history and a preselected account statement. Cancelled/credited invoices remain in history but are excluded from invoice-value totals.
- **Quick search:** press `Ctrl+K` or `⌘K` to find pages, customers and invoices. Use Tab to select a result or Enter to open the first match.

All insights use the records in this browser. Collections are not bank reconciliation or a cash-flow forecast. Multi-user roles, automatic reminder delivery, inventory movements, purchase accounting and recurring billing are not implemented.

### Retailer feature delivery plan

The current target is Indian retailers/traders, with encrypted browser-only storage. Features are delivered one milestone at a time; a planned capability is not advertised as available.

| Milestone | Scope | Acceptance gate | Status |
| --- | --- | --- | --- |
| 1. Saved invoice drafts | Incomplete orders, search/resume, duplication, confirmed deletion, backup recovery | No numbering/revenue side effects; atomic issuance; retry and stale-edit protection; failed saves retain entries; desktop/tablet/phone review | Implemented and reviewed |
| 2. Quotations → invoices | Validity date, customer/item/tax details, browser-print quotation, manually recorded accepted/rejected status, linked conversion | Expiry/state checks; one invoice per conversion; accepted prices and snapshots retained; quotations excluded from sales | Workflow implemented and reviewed; target-browser print-preview QA pending |
| 3. Reusable templates | Named item bundles, quantities, discounts and notes, create new draft from template | No old customer, invoice number or date copied; removed items/current prices reviewed; template deletion never rewrites existing records | Implemented and reviewed |
| 4. Cross-page operations | Manual stock counts/adjustments, low-stock attention, customer follow-ups/outcomes, catalog-quality review, recovery coverage | Versioned history; failed-save retention; no invoice stock deductions; backup and responsive checks | Implemented and reviewed |
| 5. Deeper retail operations | Supplier purchases, expenses, returns, fractional units and stock valuation | Confirm purchasing, valuation and return rules before implementation | Future scope |
| 6. Production platform | Shared database, server-side authorization, transactional numbering, roles and delivery integrations | Separate backend decision, tested recovery and deployment/security review | Deferred; frontend-only boundary remains |

For every milestone: implement data rules first, add migration/backup compatibility, build the workflow UI, run automated failure-path tests, inspect responsive/keyboard/reduced-motion behavior, and sync README/architecture guidance. Existing GST limitations remain in effect; this roadmap does not claim statutory compliance or online customer approval. Reference workflows: [Zoho Invoice](https://www.zoho.com/in/invoice/features/) and [Vyapar business management](https://vyaparapp.in/business-management-software).

### Sales preparation workflows

Under **Invoices → Sales preparation**, create an immutable quotation with a separate `QT` reference, customer/address, item details, discounts, GST treatment, notes and validity date (15 days by default). Review it, use **Print quotation** for the browser print dialog, and manually record acceptance or rejection with confirmation. Decisions cannot be undone; create a new quotation for revised terms. Accepted, unexpired offers can be converted once, after confirming invoice/payment dates. Conversion uses quoted prices and saved party details even if the catalog changes, but still requires available customer/product references. A converted offer links to its invoice; repeated conversion attempts reuse that invoice rather than allocating another number. Offers never appear in sales/receivables until conversion. Printing uses native browser support, not the Kendo PDF exporter; printer settings and page breaks should be checked in the target browser before sending a document.

In **Create invoice**, add items, give the internal reference a useful template name, and choose **Save item template**. This saves quantities, discounts, item tax/unit fields and notes without closing or issuing the current order. Under **Item templates**, choose **Create draft** to review a fresh order at current catalog prices and current supplier defaults. Customer/address/GSTIN/place-of-supply and payment due date are blank; no old invoice identifiers are copied. Removing a template requires confirmation and leaves existing drafts/invoices untouched. Replace obsolete templates by saving a new bundle; template editing and automatic recurring invoices are not implemented.

Quotations and templates are encrypted and included in backup previews/restoration; older backups remain supported. Each collection supports up to 200 records, with up to 100 items per record. Quotations are retained as history and cannot be deleted through the UI. These features do not provide online approvals, electronic signatures, inventory movements, automatic delivery or multi-user authorization.

### Cross-page operations

- **Products:** the manual stock desk distinguishes untracked (unknown) from counted stock. Set a whole-unit opening count, record positive/negative adjustments with a required reason, or update the reorder threshold without moving stock. Balances cannot fall below zero or exceed 1,000,000 units. Movement history is retained, expected revisions reject stale editors, and products with stock history cannot be deleted. Changing the catalog unit does not convert old stock; restore the tracked unit before making new adjustments. Limits are 1,000 tracked products and 200 movements per product; reaching a limit never silently removes history. This is not stock valuation, procurement or fractional-unit inventory. Invoices, credits, drafts and quotations do not reserve or deduct stock.
- **Catalog quality:** optional-detail filters flag missing SKU, unit/category and case-insensitive duplicate SKUs. These are setup suggestions, not GST or product-classification validation. Sum of list prices is not inventory value.
- **Customers:** schedule dated, prioritised follow-ups for collection, order enquiry or account review, with an intended conversation channel and internal preparation notes. Review/reschedule, complete with an outcome, and reopen with a reason; history remains available. Customer account views scope the desk to that relationship. Limits are 500 tasks and 100 history events per task. Completed tasks are retained rather than deleted. If a customer is removed, their saved name/history remains visible, but scheduling changes require an available customer.
- **Collections:** the same persisted tasks are filtered to collection conversations. No payment, invoice balance or bank reconciliation is changed by marking a conversation complete.
- **Overview:** low-stock priorities and upcoming customer conversations link to their operational desks. Untracked products are not presented as known available stock.
- **Settings/recovery:** backup coverage includes stock balances/movements and follow-up/outcome history. Coverage counts do not prove that a backup was downloaded or successfully restored. Validate recovery independently.

All tasks are browser-local: no calls, WhatsApp/email delivery or background notifications are triggered. Same-page desks refresh after a saved follow-up; other pages reload their data when opened. Older accounts/backups without these collections remain supported. Manual stock and follow-up mutations use the encrypted queued write path and revision checks; they are not server-enforced roles or multi-device synchronization.

### Interface standards

Premium, polished design is the default for every page and new feature. Operational pages use a centered 1,104px maximum canvas, settings 880px, and document pages 960px. Calm white headers, compact metrics, bounded search controls, readable text measures and restrained shadows take priority over oversized banners or decorative motion. Phone layouts retain 16px page gutters and responsive controls rather than compressing desktop content.

The sticky header separates brand/workspace identity and utilities from a dedicated navigation rail. It shows the actual business/account name, labels sample versus local workspaces, keeps search and sign-out separate, and links the account identity to business settings. Mobile navigation retains readable labels in a horizontally scrollable rail rather than hiding destinations behind tiny icons. Active routes, keyboard focus and reduced-motion preferences remain supported; no team, verification or cloud-sync status is implied.

Record actions use compact outlined icon controls with neutral, theme-aware resting surfaces, descriptive tooltips and visible keyboard focus. Edit gains an accent on hover; delete gains a restrained warning tone without bright permanent tiles. Sign-out uses a separate line-icon utility button. Coarse-pointer devices receive 44px targets, and interaction motion respects reduced-motion preferences. Confirmation and linked-record deletion safeguards remain unchanged.

Use the sun/moon button in the header to switch between light and dark appearance, including on public pages. On first use the app follows your system preference; a manual choice is remembered on this browser and takes priority over system changes. The non-sensitive `billflow.appearance` preference is stored separately from business records and synchronizes across tabs. If browser storage is unavailable, switching still works for the current session. Forms, menus, tables and dialogs use Tailwind utilities and the selected surface tokens. Invoice/quotation previews and printed documents stay ink-on-white; no business data is changed by the toggle.

BillFlow uses task-specific widths rather than stretching every dialog across the screen: compact decisions (440px), search/reminders (600px), stock/follow-up forms (640px), account/document views (760px), record studios (920px), and the two-column invoice composer (960px). These are maximums, not fixed mobile widths. Dialogs keep viewport gutters, scroll within their content area, and retain reachable action footers. Invoice details and statements use document-friendly page widths; settings group identity, branding and payment instructions into separate sections. Interactive density rules are screen-only so printed documents keep their own layout.

The invoice composer separates customer/schedule, tax treatment, line items and payment terms, with a live totals review and a guarded issue action. Visual feedback uses brief section arrivals, item insertion and hover/focus transitions. Operational screens avoid perpetual animation; `prefers-reduced-motion` disables animations and transitions. Navigation to a different page resets the scroll position; query-only changes keep the current position. Dirty-state confirmation, failed-save retention and browser-local data limitations remain unchanged.

Quick payment terms—Due today, Net 7, Net 15 and Net 30—set the due date relative to the invoice date. A duplicated draft retains its item bundle but requires a fresh due date. Draft review includes automated coverage for storage failures, stale revisions, repeat issuance, older backups, failed-save retention and async editor cleanup, plus browser checks of save/reload/resume/issue and responsive layouts. Financial PDF exports use jsPDF/AutoTable with embedded Noto Sans.

UI changes must be reviewed on desktop, tablet and phone: inspect dialogs and select menus, long content, keyboard focus, scrolling/action reachability, reduced motion and empty states. Keep this section aligned with the shared styles and `WorkspaceDialog` size variants; passing tests does not replace visual review.

Fields use visible labels above native inputs and selects, with associated validation/help text. Long labels stay visually bounded and retain their full accessible names. Radix dialogs trap focus, support guarded Escape/backdrop dismissal and restore focus to their opener; nested discard prompts retain unfinished input.

Outlined field labels are bounded in both resting and floating states, with ellipsis only when space is genuinely constrained; their full accessible names remain intact. Follow-up search retains a useful desktop width, while compact stock filters and mobile layouts keep their own sizing. Review long labels in light/dark themes and at narrow viewport widths.

Open **Invoices → Create invoice** to issue a domestic invoice with a financial-year number such as `BF/2627/000001`. Add quantities, units, line discounts, a due date and payment terms. For a GST-registered supplier, enable GST, provide the supplier GSTIN and state, confirm the place of supply, and enter each item's HSN/SAC and tax rate.

- Tax-exclusive calculations apply discounts before GST and round each tax component to paise. Same-state supplies split CGST and SGST/UTGST; interstate supplies use IGST.
- GSTIN validation checks syntax, state code and checksum; it does not verify registration status with GSTN. Rates and HSN/SAC classifications must be confirmed by the business.
- New invoices retain customer, supplier and product snapshots. Editing the catalog cannot change those issued details. Legacy invoices remain readable but cannot gain historical snapshots retroactively.
- Record partial or full payments by UPI, bank transfer, cash, card or cheque. These are manual records, not bank verification or payment collection. Search by customer or invoice number and filter unpaid, partial, overdue or paid invoices.
- Configure **Business settings** with your business identity, logo, GSTIN, state, payment instructions, default terms and payment period. Product records can retain HSN/SAC, GST rate and unit defaults; existing invoices retain their original snapshots.
- Issued invoices and payment records cannot be deleted. Invoice details now support cancellation, payment-record reversal and numbered full-invoice credit notes, each retaining the reason, date and user. Cancellation and credit require no active payments. These records do not process refunds or submit GST adjustments; partial credit notes are not supported.
- Open **Customers → Customer statements** for an account ledger of invoices, payments and corrections, with a running balance and PDF export. Cancelled and fully credited invoices are excluded from sales totals.

These features remain frontend-only and browser-local. They are not a tamper-proof audit trail or shared accounting ledger. Clearing browser data without a saved backup can permanently remove records. Use a backend, tested backup procedures and a professional tax review before relying on BillFlow for live business operations.

### Backup and recovery

1. Open **Business settings → Download encrypted backup**. Confirm the JSON file was actually saved and keep a copy outside browser storage, preferably on another device or trusted storage service.
2. Keep the account password used at export time. The backup includes encrypted account identity and workspace records, settings, invoice sequences, payments and corrections—not an active session. There is no password recovery.
3. In a separate browser profile, open **Sign in → Recover from an encrypted backup**, select the file and enter that password. Verify the business, backup timestamp and record counts, type `RESTORE`, then sign in normally.

Recovery never merges with or overwrites an existing account. It restores only the saved snapshot; later transactions are not recovered. Do not continue invoicing from both the original and recovered copies because their local number sequences can overlap. Backups are manual, not cloud sync, and anyone with both the file and password can decrypt them. Test recovery periodically before relying on a backup.

This is a domestic invoicing foundation, not a complete GST compliance or filing system. It does not support exports, SEZ, reverse charge, cess, composition schemes, bills of supply, e-invoice IRN/QR registration or e-way bills. The GST workflow assumes billing and delivery addresses are the same. The PDF has an authorised-signatory area but does not apply a digital signature. Number sequences are local to each browser workspace, not centrally coordinated across devices.

Invoice fields are informed by [CBIC invoice rules](https://cbic-gst.gov.in/gst-invoice-rules.html). Applicability, tax classifications and issuance requirements need review before production use.

## Local security model

Each account receives an isolated, encrypted workspace in browser storage:

- Workspace records are encrypted with **AES-GCM**.
- Encryption keys are derived from the account password using **PBKDF2-SHA-256** with a unique salt and 310,000 iterations.
- Active credentials are kept in `sessionStorage`, expire after eight hours, and are removed when the browser session ends.
- Repeated failed sign-in attempts trigger a temporary five-minute lockout.
- Registration enforces a minimum 12-character password with uppercase, lowercase, number, and symbol requirements.
- Legacy local records are migrated into the encrypted format after successful authentication.

This model protects stored workspace contents from casual inspection, but a frontend-only application cannot provide the guarantees of a trusted server. Anyone controlling the browser profile—or malicious code running on the page—may still access application data while a session is active. Use server-backed authentication, authorization, secure cookies, audit logging, and a managed database before handling real business data.

## Getting started

### Prerequisites

- [Node.js 22 or 24](https://nodejs.org/)
- [Yarn 1.22.22](https://yarnpkg.com/)

### Run locally

```bash
git clone https://github.com/bibhu-3214/Bill-Management-App.git
cd Bill-Management-App
yarn install
yarn start
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start building your workspace. No API keys, backend service, or environment variables are required.

Start only one development server per port. If port 3000 is already in use, stop the previous server with Ctrl+C or accept the alternate port offered by `yarn start`.

The app uses React Scripts 5 with a small CRACO configuration for the supported development-server middleware API and the PDF library's incomplete source maps. Application source maps, lint checks and build errors remain enabled. Hot reload polls once per second to avoid native file-watcher limits (`EMFILE`); dependency, build and cache directories are excluded. No OpenSSL compatibility flag is needed. npm and Yarn use an ignored project-local `.cache` folder, avoiding permissions on machine-wide package caches.

## Available commands

| Command | Purpose |
| --- | --- |
| `yarn start` | Start the development server |
| `yarn test --watchAll=false` | Run the automated test suite once |
| `yarn test:tooling` | Check source-map filtering and development middleware |
| `yarn build` | Create an optimized production bundle |

Installation also applies two small, versioned patches to Jest's URL dependencies so they use the maintained `punycode` package instead of Node's deprecated built-in module. Keep install scripts enabled; a failed patch stops installation so dependency changes are visible.

## Technology

- **Application:** React 17, React Router, Redux, Redux Thunk
- **Interface:** Tailwind CSS 4, Radix Dialog, native form controls, Lucide icons
- **Forms:** Formik and Yup
- **Dates:** native date controls and Moment.js
- **Documents:** jsPDF and jsPDF-AutoTable, embedded Noto Sans
- **Persistence:** Web Crypto API, `localStorage`, and `sessionStorage`
- **Testing:** Jest and React Testing Library

## Project structure

```text
src/
├── components/
│   ├── Authentication/       # Landing, registration, and sign-in
│   └── Dashboard/            # Overview, customers, products, and invoices
├── data/
│   └── localData.ts          # Encrypted browser persistence and sessions
├── Redux/
│   ├── Actions/              # Async application operations
│   └── Reducers/             # Domain state management
├── helper/                   # Protected route components
├── utils/                    # Billing and reporting utilities
├── App.tsx                    # Application routes
├── styles.css                # Tailwind entry, tokens, base, motion and print
└── styles/                   # Typed Tailwind recipes and class composition
```

## Data and privacy

- Data stays in the browser profile where it was created.
- Accounts created in one browser or device are not available in another.
- Clearing site data permanently removes local accounts and workspaces.
- There is no password recovery because BillFlow has no server or external identity provider.
- Export important invoices before clearing browser storage.

## Quality checks

Before submitting changes, run:

```bash
yarn test --watchAll=false
yarn test:tooling
yarn exec eslint src
yarn build
```

The test suite covers encrypted local persistence, Redux transitions, billing calculations, failed-save retention, discard confirmation, dialog variants, accessible authentication labels and route scroll resets. Also follow the interface review checklist above using fictional demo data.

**Known release check:** browser review reports a missing-license warning from `@progress/kendo-react-pdf`. A successful build does not resolve that warning. Review the PDF dependency's licensing and activation before commercial distribution; do not hide the warning as a styling fix.

## Roadmap

- Server-backed authentication and multi-device synchronization
- Role-based workspace access
- Partial credit notes and broader GST workflows
- Import and export for customer and product data
- Expanded accessibility and end-to-end testing

## Contributing

Contributions are welcome. Fork the repository, create a focused branch, verify the test and production builds, and open a pull request with a concise description of the change.

## Disclaimer

BillFlow is provided as a demonstration project. Validate all calculations and apply the security, compliance, backup, and retention controls required by your organization before using billing software in production.

## Sample workspace and project documentation

## Interface preview

Actual screenshots from the local production build using fictional demo data.

![BillFlow sample dashboard](docs/screenshots/dashboard.jpg)

<details>
<summary>Invoice workspace and mobile layout</summary>

![Invoice workspace](docs/screenshots/invoices.jpg)
<img src="docs/screenshots/mobile.jpg" alt="BillFlow mobile dashboard" width="320" />

</details>

## Explore in two minutes

1. Run the app locally using the commands below.
2. Choose **Explore live demo**. The app opens a fictional workspace with three customers, four products and six invoices.
3. Open **Customers**, **Products** and **Invoices**. Create an invoice and inspect its details.
4. Sign out and reopen the demo to reset the sample data.

Demo changes are isolated to the current browser tab's session. Existing local accounts remain separate. To explore persistence, create a local account instead.


[Architecture & trade-offs](docs/ARCHITECTURE.md) · [Validation history](docs/VALIDATION.md) · [Quality workflow](.github/workflows/quality.yml) · [Deployment guide](docs/DEPLOYMENT.md)

The screenshots and validation history describe the earlier portfolio baseline. This branch uses React Scripts 5 and the expanded billing workflows described above.
