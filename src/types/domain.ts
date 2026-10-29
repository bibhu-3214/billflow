export type NumericInput = number | string;
export interface UserProfile { _id: string; username: string; email: string; businessName: string; address: string; createdAt?: string; isDemo?: boolean; isCloud?: boolean }
export interface Credentials { email: string; password: string }
export interface Registration extends Credentials { username: string; businessName: string; address: string }
export interface Customer { _id: string; name: string; mobile: string; email: string; address?: string; company?: string; contactPerson?: string; state?: string; gstin?: string; notes?: string; createdAt?: string }
export type CustomerInput = Partial<Omit<Customer, '_id'>>;
export interface Product { _id: string; name: string; price: number; unit?: string; hsn?: string; gstRate?: NumericInput; sku?: string; category?: string; description?: string; createdAt?: string }
export type ProductInput = Partial<Omit<Product, '_id' | 'price'>> & { price?: NumericInput };
export interface BusinessSettings { name: string; address: string; gstin: string; state: string; terms: string; dueDays: number; bankDetails: string; logo: string }
export interface InvoiceLineInput { _id?: string; product?: string; name?: string; price: NumericInput; quantity: NumericInput; discount?: NumericInput; gstRate?: NumericInput; unit?: string; hsn?: string; subTotal?: number }
// Catalog-backed commands may omit price; saved/quoted lines and direct calculations require it.
export type CatalogLineInput = Omit<InvoiceLineInput, 'price'> & { price?: NumericInput };
export interface InvoiceLine extends Omit<InvoiceLineInput, 'price' | 'quantity' | 'discount' | 'gstRate'> { price: number; quantity: number; discount?: number; gstRate?: number; gross?: number; discountAmount?: number; taxable?: number; cgst?: number; stateTax?: number; igst?: number; subTotal: number }
export interface TaxOptions { gst?: boolean; supplierState?: string; placeOfSupply?: string }
export interface Payment { _id: string; date: string; amount: number; method: string; reference?: string; actor?: string; createdAt?: string }
export interface Reversal { _id?: string; paymentId: string; date: string; amount: number; reason: string; actor?: string }
export interface Correction { date: string; reason: string; actor?: string }
export interface CreditNote extends Correction { number: string; amount: number; taxable?: number; cgst?: number; stateTax?: number; igst?: number }
export interface Invoice extends TaxOptions { _id: string; customer: string; date: string; createdAt?: string; dueDate?: string; lineItems: InvoiceLine[]; total: number; invoiceNumber?: string; gross?: number; discountAmount?: number; taxable?: number; cgst?: number; stateTax?: number; igst?: number; localTax?: string; interstate?: boolean; notes?: string; payments?: Payment[]; reversals?: Reversal[]; cancellation?: Correction; creditNote?: CreditNote; supplierSnapshot?: Partial<BusinessSettings>; customerSnapshot?: Partial<Customer>; sourceDraftId?: string; sourceQuotationId?: string; sourceQuotationNumber?: string }
export interface DraftInput extends TaxOptions { title?: string; customer?: string; date?: string; dueDate?: string; billingAddress?: string; notes?: string; supplierGSTIN?: string; customerGSTIN?: string; lineItems: CatalogLineInput[] }
export interface Draft extends Omit<DraftInput, 'lineItems'> { lineItems: InvoiceLineInput[]; _id: string; revision: number; createdAt?: string; updatedAt?: string }
export interface Quotation extends Draft { title: string; date: string; dueDate: string; customer: string; decidedAt?: string; number: string; status: 'open' | 'accepted' | 'rejected' | 'converted'; supplierSnapshot?: Partial<BusinessSettings>; customerSnapshot?: Partial<Customer>; invoiceId?: string }
export interface InvoiceTemplate { _id: string; title: string; lineItems: InvoiceLineInput[]; notes?: string; revision: number; createdAt?: string }
export interface InvoiceInput extends Omit<DraftInput, 'lineItems'> { lineItems?: CatalogLineInput[]; draftId?: string; draftRevision?: number; quotationId?: string; quotationRevision?: number }
export interface StockMovement { _id?: string; type: 'opening' | 'adjustment' | 'threshold'; delta: number; balance: number; reorderLevel: number; reason: string; date?: string; at: string; actor?: string }
export interface StockRecord { name: string; product: string; unit: string; onHand: number; reorderLevel: number; revision: number; movements: StockMovement[] }
export interface StockInput { product: string; unit?: string; onHand?: NumericInput; delta?: NumericInput; reorderLevel?: NumericInput; reason?: string; revision?: number; type?: string }
export interface FollowUpEvent { _id?: string; action: string; at: string; date?: string; dueDate?: string; outcome?: string; actor?: string; priority?: string; channel?: string; purpose?: string; title?: string; notes?: string }
export interface FollowUp { _id: string; customer: string; customerName: string; title: string; dueDate: string; priority: string; channel: string; purpose: string; notes?: string; status: 'open' | 'completed'; revision: number; history: FollowUpEvent[]; createdAt?: string; updatedAt?: string }
export type FollowUpInput = Partial<Omit<FollowUp, '_id' | 'history'>>;
export interface Workspace { customers: Customer[]; products: Product[]; bills: Invoice[]; invoiceDrafts: Draft[]; quotations: Quotation[]; invoiceTemplates: InvoiceTemplate[]; stockRecords: StockRecord[]; followUps: FollowUp[]; settings: Partial<BusinessSettings>; invoiceSequences: Record<string, number>; quotationSequence: number }
export type CollectionName = 'customers' | 'products' | 'bills' | 'invoiceDrafts' | 'quotations' | 'invoiceTemplates' | 'stockRecords' | 'followUps';
export interface EncryptedPayload { version: 2; iv: string; ciphertext: string }
export interface StoredUser extends UserProfile { passwordHash?: string; passwordSalt?: string; passwordVerifier?: string; authVersion?: number; failedAttempts?: number; lockedUntil?: number }
export interface BrowserDatabase { users: StoredUser[]; workspaces: Record<string, EncryptedPayload> }
export interface BrowserSession { userId: string; workspaceKey: string; token: string; expiresAt: number }
export interface PaymentInput { amount: NumericInput; date: string; method: string; reference?: string }
export interface CorrectionInput { action: string; reason?: string; paymentId?: string }
export interface BackupPreview { email: string; businessName: string; createdAt: string; customers: number; products: number; invoices: number; drafts: number; quotations: number; templates: number; followUps: number; trackedProducts: number }
export interface TransferPayload { format: 'billflow-workspace'; version: 1; workspace: Pick<Workspace, 'customers' | 'products' | 'bills'> & Partial<Workspace>; profile?: UserProfile; createdAt?: string }
export interface ImportPreview { digest: string; revision: number; counts: Record<CollectionName, number>; canImport: boolean }
export interface PublicConfig { csrfToken: string; supportEmail?: string; providers?: string[] }
export interface AppError extends Error { cancelled?: boolean; status?: number }
export function asAppError(value: unknown): AppError {
    if (value instanceof Error) return value;
    const input = value && typeof value === 'object' ? value as { message?: unknown; cancelled?: boolean; status?: number } : {};
    return Object.assign(new Error(typeof input.message === 'string' ? input.message : String(value)), { cancelled: input.cancelled, status: input.status });
}

export interface EncryptedBackup { format: 'billflow-encrypted-backup'; version: 1; salt: string; payload: EncryptedPayload }
export interface BackupContents { profile: UserProfile; workspace: Pick<Workspace, 'customers' | 'products' | 'bills'> & Partial<Workspace>; createdAt: string }
