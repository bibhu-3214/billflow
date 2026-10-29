# PDF exports

Invoices, full credit notes and customer statements download directly using jsPDF 4.2.1 and jsPDF-AutoTable 5.0.8. The renderer uses saved data, not DOM screenshots or HTML capture. Existing screen previews and native quotation printing remain separate.

## Layout and data

- A4 portrait, explicit ink-on-white colours, 14 mm side margins, repeated document/table headings and numbered footers. Table rows wrap; normal rows remain together. Very tall rows may split across pages. Totals remain together.
- Saved supplier/customer/item snapshots take priority. Legacy invoices retain the existing catalog-name fallback and carry a legacy warning. Stored totals and the existing payment/statement helpers remain authoritative; exporting does not recalculate or modify records.
- Discounts, taxable value, CGST plus SGST/UTGST or IGST, invoice/credit totals, payments and balances are retained. Credit notes retain the original invoice, reason, actor and refund/filing limitation.
- The PDF module loads on demand. Two same-origin TTF font files are fetched on first export and cached for that page session. Failed font loads can be retried. No document data is sent to a service.
- Embedded Noto Sans supports rupees and accented Latin text. The renderer checks glyph coverage and refuses unsupported scripts/emoji with a visible error rather than exporting missing characters. This is not an Indic-script shaping implementation. Saved records remain unchanged; use Latin text for the export. It is not PDF/A or tagged-PDF certification.
- PNG/JPEG data-URL logos retain aspect ratio within a 40 × 18 mm box. External URLs, malformed logos and images exceeding 4 million pixels stop the export. The existing 130 KB upload boundary remains. PNG decoded data is bounded to 32 MiB and its declared scanline size before the PDF decoder runs. Compressed ancillary metadata is stripped; palette/transparency data is retained. No remote logo fetch is performed.
- Download names preserve invoice/credit references with filesystem separators and control characters replaced. Statements retain `Statement-YYYY-MM-DD.pdf`.
- MIT notices for jsPDF/AutoTable and the SIL OFL 1.1 font notice are shipped in `public/licenses`, referenced by `public/THIRD_PARTY_NOTICES.txt`. Kendo packages, unused transitives and the Kendo-specific source-map exception were removed. This is not an audit of all dependency licenses.

## Reproduce validation

```sh
yarn install --frozen-lockfile --non-interactive
CI=true yarn test --watchAll=false --runInBand
yarn test:tooling
yarn typecheck
CI=true yarn build
node scripts/pdf-samples.cjs ../output/pdf
# Optional local QA environment: pip install pypdf pypdfium2 pillow
python scripts/verify-pdfs.py ../output/pdf
```

The Node fixture generator calls the production PDF renderer with fictional records. The Python checker extracts text, checks totals and repeated headings, verifies all 75 invoice/credit item descriptions, checks logo resources, and renders every page plus contact sheets. Inspect those PNGs as well as the automatic assertions. Fixtures include seven-page invoices, eight-page credits, five-page statements, interstate GST, empty statements, legacy invoices, cancellations, wide PNG and tall JPEG logos.

## Validation on 14 October 2026

Node 22.13.0, Yarn 1.22.22: production build and ESLint passed; 97 tests in 24 Jest suites and four tooling tests passed. Invalid logos and unsupported Devanagari/emoji are covered by rejection tests. Component tests verify invoice/credit/statement button wiring and visible export errors. PDF text extraction verified rupees, accented customer names, all item rows, repeated table headings and expected totals. All multi-page contact sheets and representative full-size pages were visually inspected without clipping or overlapping content. Wide PNG and tall JPEG proportions were inspected.

PDF generation runs without a DOM and uses fixed colours, so dark-mode CSS cannot alter the generated document. A browser smoke check opened the sample workspace and invoice details in dark mode, but the Chrome extension detached while waiting for the download event. Actual Chrome download completion and a light/dark browser-download comparison remain unverified; do not describe those checks as passed. The existing download attempt has an uncertain outcome and was not repeated.

No push, merge or public deployment was performed. Before publication, complete the browser download check for all three document types and verify the hosted font URLs and SPA routing.
