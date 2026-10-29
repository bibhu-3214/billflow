import type { Invoice, InvoiceLineInput, NumericInput, TaxOptions } from '../types/domain';
import Decimal from 'decimal.js';

export const states: Record<string, string> = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
    '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
    '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};
export const money = (value: NumericInput | null | undefined) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
export const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const paise = (value: Decimal.Value) => new Decimal(value).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
export const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const financialYear = (date: string) => {
    if (!validDate(date)) throw new Error('Choose a valid invoice date.');
    const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
    return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
};

export const validGSTIN = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value) || !states[value.slice(0, 2)]) return false;
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const sum = value.slice(0, 14).split('').reduce((total, char, index) => {
        const product = alphabet.indexOf(char) * (index % 2 === 0 ? 1 : 2);
        return total + Math.floor(product / 36) + product % 36;
    }, 0);
    return alphabet[(36 - sum % 36) % 36] === value[14];
};

export const calculateInvoice = <T extends InvoiceLineInput>(items: T[], { gst = false, supplierState = '', placeOfSupply = '' }: TaxOptions = {}) => {
    if (!items.length) throw new Error('Add at least one product.');
    if (gst && (!states[supplierState] || !states[placeOfSupply])) throw new Error('Select supplier state and place of supply.');
    const interstate = supplierState !== placeOfSupply;
    const localTax = ['04', '26', '31', '35', '38'].includes(supplierState) ? 'UTGST' : 'SGST';
    const lineItems = items.map(item => {
        if (gst && (item.gstRate === '' || item.gstRate == null)) throw new Error('Confirm the GST rate for every item, including 0% where applicable.');
        const price = Number(item.price), quantity = Number(item.quantity);
        const discount = Number(item.discount || 0), rate = gst ? Number(item.gstRate) : 0;
        if (![price, quantity, discount, rate].every(Number.isFinite) || price <= 0 || price > 100000000 ||
            !Number.isInteger(quantity) || quantity < 1 || quantity > 10000 || discount < 0 || discount > 100 || rate < 0 || rate > 40) {
            throw new Error('Check price, quantity (1–10,000), discount (0–100%) and GST rate (0–40%).');
        }
        const gross = paise(price) * quantity;
        const discountPaise = new Decimal(gross).times(discount).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
        const taxable = gross - discountPaise;
        const cgst = gst && !interstate ? new Decimal(taxable).times(rate).div(200).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber() : 0;
        const stateTax = cgst;
        const igst = gst && interstate ? new Decimal(taxable).times(rate).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber() : 0;
        return { ...item, price: paise(price) / 100, quantity, discount, gstRate: rate,
            gross: gross / 100, discountAmount: discountPaise / 100, taxable: taxable / 100,
            cgst: cgst / 100, stateTax: stateTax / 100, igst: igst / 100,
            subTotal: (taxable + cgst + stateTax + igst) / 100 };
    });
    const sum = (key: 'gross' | 'discountAmount' | 'taxable' | 'cgst' | 'stateTax' | 'igst' | 'subTotal') => lineItems.reduce((total, item) => total + paise(item[key]), 0) / 100;
    if ((['gross', 'subTotal', 'taxable'] as const).some(key => sum(key) > 1000000000000)) throw new Error('Invoice amounts cannot exceed INR 1,000,000,000,000.');
    return { lineItems, gross: sum('gross'), discountAmount: sum('discountAmount'), taxable: sum('taxable'),
        cgst: sum('cgst'), stateTax: sum('stateTax'), igst: sum('igst'), total: sum('subTotal'), localTax, interstate };
};

export const paymentSummary = (bill: Pick<Invoice, 'total'> & Partial<Invoice>, date = today()) => {
    const reversed = new Set((bill.reversals || []).map(r => r.paymentId));
    const paid = (bill.payments || []).filter(p => !reversed.has(p._id)).reduce((sum, payment) => sum + paise(payment.amount), 0);
    const balance = bill.cancellation || bill.creditNote ? 0 : Math.max(0, paise(bill.total) - paid) / 100;
    return { paid: paid / 100, balance, status: bill.cancellation ? 'Cancelled' : bill.creditNote ? 'Credited' : balance === 0 ? 'Paid' :
        bill.dueDate && bill.dueDate < date ? 'Overdue' : paid > 0 ? 'Partially paid' : 'Unpaid' };
};
