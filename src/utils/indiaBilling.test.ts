import { calculateInvoice, financialYear, paymentSummary, validGSTIN } from './indiaBilling';

const item = { price: 100, quantity: 2, discount: 10, gstRate: 18 };
test('discounts precede split tax and interstate tax has the same total', () => {
    const local = calculateInvoice([item], { gst: true, supplierState: '21', placeOfSupply: '21' });
    expect(local).toMatchObject({ gross: 200, discountAmount: 20, taxable: 180, cgst: 16.2, stateTax: 16.2, igst: 0, total: 212.4 });
    expect(calculateInvoice([item], { gst: true, supplierState: '21', placeOfSupply: '27' })).toMatchObject({ cgst: 0, stateTax: 0, igst: 32.4, total: 212.4 });
});
test('uses UTGST and rounds individual components to paise', () => {
    expect(calculateInvoice([{ ...item, price: 0.1, quantity: 1, discount: 0 }], { gst: true, supplierState: '04', placeOfSupply: '04' }))
        .toMatchObject({ localTax: 'UTGST', total: 0.12, cgst: 0.01, stateTax: 0.01 });
});
test('validates dates, rates and GSTIN checksum', () => {
    expect(financialYear('2026-03-31')).toBe('2526');
    expect(financialYear('2026-04-01')).toBe('2627');
    expect(() => financialYear('2026-02-30')).toThrow();
    expect(() => calculateInvoice([{ ...item, quantity: -1 }])).toThrow();
    expect(() => calculateInvoice([{ ...item, discount: 101 }])).toThrow();
    expect(() => calculateInvoice([{ ...item, gstRate: '' }], { gst: true, supplierState: '21', placeOfSupply: '21' })).toThrow();
    expect(validGSTIN('27AAPFU0939F1ZV')).toBe(true);
    expect(validGSTIN('27AAPFU0939F1ZA')).toBe(false);
});
test('derives unpaid, partial, overdue and paid balances without floating-point residue', () => {
    const bill = { total: 0.3, dueDate: '2026-10-09', payments: [] as import('../types/domain').Payment[] };
    expect(paymentSummary(bill, '2026-10-08').status).toBe('Unpaid');
    bill.payments.push({ _id: 'p1', date: '2026-10-08', method: 'Cash', amount: 0.1 });
    expect(paymentSummary(bill, '2026-10-08')).toEqual({ paid: 0.1, balance: 0.2, status: 'Partially paid' });
    expect(paymentSummary(bill, '2026-10-10').status).toBe('Overdue');
    bill.payments.push({ _id: 'p2', date: '2026-10-08', method: 'Cash', amount: 0.2 });
    expect(paymentSummary(bill, '2026-10-10')).toEqual({ paid: 0.3, balance: 0, status: 'Paid' });
});
