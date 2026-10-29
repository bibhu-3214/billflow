import type { Invoice } from '../types/domain';
import { paise } from './indiaBilling';

export const statementRows = (bills: Invoice[], customerId: string) => {
    const rows: { date: string; reference: string; description: string; debit: number; credit: number; order: number }[] = [];
    bills.filter(b => b.customer === customerId).forEach(bill => {
        const reference = bill.invoiceNumber || bill._id;
        rows.push({ date: bill.date.slice(0, 10), reference, description: 'Invoice', debit: paise(bill.total), credit: 0, order: 0 });
        (bill.payments || []).forEach(p => rows.push({ date: p.date, reference, description: 'Payment · ' + p.method + (p.reference ? ' · ' + p.reference : ''), debit: 0, credit: paise(p.amount), order: 1 }));
        (bill.reversals || []).forEach(r => rows.push({ date: r.date, reference, description: 'Payment reversal · ' + r.reason, debit: paise(r.amount), credit: 0, order: 2 }));
        if (bill.cancellation) rows.push({ date: bill.cancellation.date, reference, description: 'Cancellation · ' + bill.cancellation.reason, debit: 0, credit: paise(bill.total), order: 3 });
        if (bill.creditNote) rows.push({ date: bill.creditNote.date, reference: bill.creditNote.number, description: 'Credit against ' + reference + ' · ' + bill.creditNote.reason, debit: 0, credit: paise(bill.total), order: 3 });
    });
    let balance = 0;
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order).map(row => {
        balance += row.debit - row.credit;
        return { ...row, debit: row.debit / 100, credit: row.credit / 100, balance: balance / 100 };
    });
};
