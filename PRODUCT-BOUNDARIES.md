# BillFlow: customer intelligence and reviewed purchase history

BillFlow is the destination for billing and customer intelligence. **Customer insights** combines billing customer accounts with separately labelled historical purchase records from Customer Insights. Historical purchase values do not alter invoices, GST, numbering, payments, stock or receivables.

To transfer Customer Insights records:
1. Use an existing Customer Insights JSON export. The standalone source app is retired. Keep the original file.
2. Sign into the intended BillFlow business, open **Customer insights**, and choose **Import Customer Insights**.
3. Review new and duplicate counts. Optionally map each source phone group to an existing customer; unlinked history remains readable without creating customer profiles.
4. Type **IMPORT**, confirm, inspect the purchase history, and export a BillFlow backup.

The import preserves source IDs, dates, integer-paise amounts and timestamps. Existing imported IDs are skipped, never overwritten. The standalone Customer Insights app is retired and its GitHub repository is archived. Saved JSON exports remain supported. Reused source IDs across unrelated source accounts are treated as duplicates, so review counts before combining accounts. No automatic matching by email, phone or name occurs.

Cloud imports require an authenticated, verified owner and CSRF protection. A reviewed digest and workspace revision prevent a changed or stale preview from committing. Imports are atomic, owner scoped and audited. Encrypted local-browser mode supports the same review and backup flow. Full workspace backups include historical purchases and explicit customer links; linked customers cannot be deleted while referenced.
