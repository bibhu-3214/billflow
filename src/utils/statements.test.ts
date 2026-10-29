import { statementRows } from './statements';
import { paymentSummary } from './indiaBilling';

test('statement reconciles reversals and full credits without losing the original payment', () => {
    const bill = { lineItems: [], _id: 'b', customer: 'c', date: '2026-04-01', total: 100, invoiceNumber: 'BF/2627/000001',
        payments: [{ _id: 'p', date: '2026-04-02', method: 'UPI', amount: 40 }],
        reversals: [{ paymentId: 'p', date: '2026-04-03', amount: 40, reason: 'Wrong entry' }],
        creditNote: { amount: 100, number: 'CN/2627/000001', date: '2026-04-04', reason: 'Full return' } };
    const rows = statementRows([bill], 'c');
    expect(rows.map(r => r.balance)).toEqual([100, 60, 100, 0]);
    expect(paymentSummary(bill)).toEqual({ paid: 0, balance: 0, status: 'Credited' });
    expect(statementRows([bill], 'someone-else')).toEqual([]);
    expect(paymentSummary({ total: 50, cancellation: { date: '2026-04-04', reason: 'Error' } }).status).toBe('Cancelled');
});
