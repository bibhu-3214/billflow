# Retail billing upgrades

The first retail milestone is implemented in the web invoice and quotation editors. The benchmarks are the everyday retail workflows in [Vyapar](https://vyaparapp.in/) and [myBillBook](https://mybillbook.in/), with [Zoho Invoice](https://www.zoho.com/in/invoice/) as a reference for a clear review-to-invoice flow. This is an incremental BillFlow implementation, not a claim of feature parity.

## First milestone: faster item entry

| Previously | Now |
| --- | --- |
| Scroll the complete product dropdown | Search names, existing SKUs and categories, then choose from filtered products |
| Add one unit and edit the invoice line | Set a whole quantity from 1 to 10,000 before adding |
| No scanner entry action | Press Enter to add a unique match; keyboard-style scanners can enter a saved SKU |
| Scan text could submit the surrounding form | Enter in item search or add-quantity adds only an item; invoice issuance remains explicit |

Exact SKU matches take priority over partial name matches. Leading zeros are retained and matching ignores surrounding whitespace/case. Duplicate SKUs require an explicit product selection. Unmatched/ambiguous input and invalid quantities retain the entry for correction. Successful additions return focus to search for the next item. Repeated additions remain separate editable lines, preserving per-line quantities and discounts.

The existing 100-line limit remains enforced. Invoice review, drafts, quotation conversion, immutable issued details, domestic tax calculations and manual payment recording continue through their existing paths. No database migration is needed: lookup uses existing catalog metadata and saves the same product references.

This supports text-and-Enter keyboard input. Camera scanning, barcode generation, a separate barcode field and physical-scanner acceptance are not part of this milestone. Stock counts remain manual, and payment recording does not process a payment.

## Validation

Strict TypeScript/no-any checks, 131 frontend tests across 32 suites, three tooling checks, and the connected production build passed. Eight browser cases passed on disposable PostgreSQL: desktop/tablet/phone scan-and-quantity entry through draft/resume/issue/payment, existing modal/theme/print checks, and both loopback CSRF checks. The item picker was inspected at all three viewport sizes in light and dark themes. Keyboard scanner input was simulated; physical hardware was not tested.

## Premium workspace foundation

A second milestone adds desktop workspace navigation and a responsive mobile navigation rail, a data-backed overview, financial action cards, recent invoice links and a setup checklist. Interactive 3/6/12-month invoice charts support keyboard selection and an accessible figures table. Displayed amounts distinguish issued value, manually recorded payments, outstanding balances and overdue balances; reversals and corrections retain their existing accounting behavior.

The sales workspace separates issued invoices, saved drafts and offers/templates. Views have shareable URLs; saved drafts and offers open in their matching view. Direct invoice actions open the editor once and restore focus on dismissal. Customer lookup searches name/company/contact/GSTIN and selects only a unique match on Enter; searching alone preserves the current billing customer. Contact details distinguish matching names in the picker.

Pages now load on demand. A failed route chunk displays a contained recovery message while navigation remains available. The connected main JavaScript entry decreased from 715,789 to 431,820 bytes (39.7%); this measures the entry file, not total transferred assets or real-user latency. UI messages distinguish connected account storage from browser-only storage. Physical-device, production hosting and full accounting acceptance remain separate.

Validation: strict types/no-any lint, 140 tests in 35 suites, three tooling checks, both production build modes and thirteen browser cases, including a deliberately aborted production route chunk. Existing tests cover SKU/quantity billing through draft/resume/issue/payment, dialogs, printing and both local hostnames. New browser checks cover chart interactions, navigation, focused sales views, direct invoice entry, empty data and light/dark layouts. Browser data is synthetic and stored in disposable PostgreSQL.

## Subsequent scope to define

- More counter-sale convenience, including customer lookup and explicit repeated-item quantity controls.
- Purchasing/expense records and their accounting rules.
- Invoice-driven stock movements, returns and valuation with audited reversal rules.
- Customer delivery/payment integrations, with providers and send/payment actions explicitly configured.

These are follow-up candidates, not delivered features. The current public-release and native-device limits remain in [delivery status](DELIVERY-STATUS.md).
