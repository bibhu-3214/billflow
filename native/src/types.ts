import type { Customer, Invoice, InvoiceLineInput, NumericInput, Payment, Reversal, UserProfile, Workspace } from '../../src/types/domain';
export type WorkspaceResponse = { format: 'billflow-workspace'; version: 1; workspace: Workspace; profile: UserProfile };
export type EditorKind = 'customer' | 'product' | 'settings' | 'stock' | 'followup' | 'payment' | 'correction' | 'status' | 'invoice' | 'draft' | 'quote' | 'template';
export interface EditorRecord {
    _id?: string; revision?: number; title?: string; name?: string; email?: string; mobile?: string; company?: string; contactPerson?: string; address?: string;
    customer?: string; customerName?: string; date?: string; dueDate?: string; notes?: string; state?: string; gstin?: string;
    price?: NumericInput; gstRate?: NumericInput; unit?: string; hsn?: string; sku?: string; category?: string; description?: string;
    dueDays?: NumericInput; terms?: string; bankDetails?: string; logo?: string; gst?: boolean; supplierGSTIN?: string; supplierState?: string; customerGSTIN?: string; placeOfSupply?: string; billingAddress?: string;
    product?: string; delta?: NumericInput; reorderLevel?: NumericInput; reason?: string; type?: string;
    channel?: string; purpose?: string; priority?: string; status?: string; outcome?: string;
    amount?: NumericInput; method?: string; reference?: string; action?: string; paymentId?: string;
    quotationId?: string; quotationRevision?: number; lineItems?: InvoiceLineInput[]; payments?: Payment[]; reversals?: Reversal[];
}
export type EditorValues = Omit<EditorRecord, 'lineItems'> & { lineItems: InvoiceLineInput[] };
export type TextFieldKey = { [K in keyof EditorValues]-?: string extends EditorValues[K] ? K : never }[keyof EditorValues];
export type EditorState = { kind: EditorKind; title: string; record?: EditorRecord };
export type InvoicePreview = { taxable: number; cgst: number; stateTax: number; localTax: string; igst: number; total: number };
export type Searchable = Partial<Pick<Customer, 'name'> & Pick<EditorRecord, 'title'> & Pick<Invoice, 'invoiceNumber'>> & {number?: string};
