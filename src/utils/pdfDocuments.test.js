/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { createInvoicePdf, createStatementPdf, pdfFilename } from './pdfDocuments';
import { calculateInvoice } from './indiaBilling';

const fonts = ['Regular', 'Bold'].map(style => fs.readFileSync(path.join(process.cwd(), `public/fonts/NotoSans-${style}.ttf`)).toString('base64'));
const customer = { _id: 'c', name: 'Café Müller', address: 'Example Street' };
const base = { _id: 'b', invoiceNumber: 'BF/2627/000001', date: '2026-10-14', customer: 'c', customerSnapshot: customer, supplierSnapshot: { name: 'Sample business' }, gst: true, supplierState: '29', placeOfSupply: '29' };
const items = [{ _id: 'i', name: 'Sample ₹ item', quantity: 2, price: 1234.56, discount: 10, gstRate: 18 }];
const bill = { ...base, ...calculateInvoice(items, base) };

test('embeds searchable Unicode fonts, preserves snapshot input and sanitizes download names', () => {
    const before = JSON.stringify(bill);
    const { doc, filename } = createInvoicePdf({ bill, fonts });
    expect(filename).toBe('BF-2627-000001.pdf');
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('/ToUnicode');
    expect(JSON.stringify(bill)).toBe(before);
    expect(pdfFilename('a/b\\c:?*\u0000')).toBe('a-b-c----.pdf');
    expect(pdfFilename(null)).toBe('Invoice.pdf');
});

test('long invoice and credit tables paginate while an empty statement remains downloadable', () => {
    const long = { ...base, ...calculateInvoice(Array.from({ length: 100 }, (_, i) => ({ ...items[0], _id: String(i), name: `Product ${i} with a long item description`.repeat(3) })), base) };
    expect(createInvoicePdf({ bill: long, fonts }).doc.getNumberOfPages()).toBeGreaterThan(2);
    long.creditNote = { number: 'CN/2627/000001', date: base.date, amount: long.total, taxable: long.taxable, reason: 'Full return', actor: 'Operator' };
    const credit = createInvoicePdf({ bill: long, fonts, credit: true });
    expect(credit.doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(credit.filename).toBe('CN-2627-000001.pdf');
    expect(createStatementPdf({ bills: [], customer, business: {}, fonts, date: base.date }).filename).toBe('Statement-2026-10-14.pdf');
});

test('rejects unsupported glyphs, external or malformed logos and absent credit notes', () => {
    expect(() => createInvoicePdf({ bill: { ...bill, notes: 'नमस्ते' }, fonts })).toThrow(/font does not support/);
    expect(() => createInvoicePdf({ bill: { ...bill, notes: '😀' }, fonts })).toThrow(/font does not support/);
    for (const logo of ['https://example.com/logo.png', 'data:image/png;base64,AAAA']) {
        expect(() => createInvoicePdf({ bill: { ...bill, supplierSnapshot: { logo } }, fonts })).toThrow(/PDF logo/);
    }
    expect(() => createInvoicePdf({ bill, fonts, credit: true })).toThrow(/no credit note/);
});
