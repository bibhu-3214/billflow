import type { RootState } from '../Redux/types';
import type { BusinessSettings, Customer, Draft, Invoice, InvoiceTemplate, Product, Quotation } from '../types/domain';

export const customerFixture = (values: Partial<Customer> = {}): Customer => ({ _id: 'customer', name: 'Buyer', email: '', mobile: '', ...values });
export const productFixture = (values: Partial<Product> = {}): Product => ({ _id: 'product', name: 'Product', price: 100, ...values });
export const invoiceFixture = (values: Partial<Invoice> = {}): Invoice => ({ _id: 'invoice', customer: 'customer', date: '2026-10-09', lineItems: [], total: 100, ...values });
export const draftFixture = (values: Partial<Draft> = {}): Draft => ({ _id: 'draft', revision: 1, lineItems: [], ...values });
export const quotationFixture = (values: Partial<Quotation> = {}): Quotation => ({ ...draftFixture(), _id: 'quote', title: 'Offer', customer: 'customer', date: '2026-10-09', dueDate: '2026-10-24', number: 'QT/2627/000001', status: 'open', ...values });
export const templateFixture = (values: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({ _id: 'template', revision: 1, title: 'Template', lineItems: [], ...values });
export const settingsFixture = (values: Partial<BusinessSettings> = {}): BusinessSettings => ({ name: 'Shop', address: 'Mumbai', dueDays: 0, gstin: '', state: '', terms: '', bankDetails: '', logo: '', ...values });

interface StateFixture {
    users?: Partial<RootState['users']>;
    customers?: Partial<Customer>[];
    products?: Partial<Product>[];
    bills?: { bills?: Partial<Invoice>[]; billDetails?: Partial<Invoice> };
}
export function createRootState(values: StateFixture = {}): RootState {
    return {
        users: { isLoggedIn: false, userDetails: {}, ...values.users },
        customers: (values.customers || []).map(customerFixture),
        products: (values.products || []).map(productFixture),
        bills: { bills: (values.bills?.bills || []).map(invoiceFixture), billDetails: values.bills?.billDetails || {} },
    };
}
