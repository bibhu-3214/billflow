import type { Invoice, Customer } from '../types/domain';
import { paymentSummary, today, validDate, paise, money } from './indiaBilling';

const day = (value: string) => Date.parse(value + 'T00:00:00Z') / 86400000;
export const receivableRows = (bills: Invoice[], customers: Customer[] = [], asOf = today()) => bills.map(bill => {
    const summary = paymentSummary(bill, asOf);
    const due = validDate(bill.dueDate) ? bill.dueDate : null;
    const overdueDays = due ? Math.max(0, day(asOf) - day(due)) : 0;
    const daysUntilDue = due ? day(due) - day(asOf) : null;
    const customer = bill.customerSnapshot || customers.find(c => c._id === bill.customer) || {};
    return { ...bill, ...summary, customerName: customer.name || 'Customer unavailable', overdueDays, daysUntilDue,
        bucket: !due ? 'No due date' : overdueDays === 0 ? 'Not overdue' : overdueDays <= 30 ? '1–30 days' : overdueDays <= 60 ? '31–60 days' : overdueDays <= 90 ? '61–90 days' : '90+ days' };
});

export const agingSummary = (rows: ReturnType<typeof receivableRows>) => ['Not overdue', '1–30 days', '31–60 days', '61–90 days', '90+ days', 'No due date'].map(label => {
    const matching = rows.filter(row => row.balance > 0 && row.bucket === label);
    return { label, count: matching.length, amount: matching.reduce((sum, row) => sum + paise(row.balance), 0) / 100 };
});

export const reminderText = (row: ReturnType<typeof receivableRows>[number]) => `Hello ${row.customerName},\n\nA reminder for ${row.invoiceNumber ? 'invoice ' + row.invoiceNumber : 'your invoice dated ' + row.date.slice(0, 10)}${row.dueDate ? ', due ' + row.dueDate : ''}. The outstanding balance in our records is ${money(row.balance)}.\n\nIf you have already paid, please share the payment reference so we can reconcile our records. Thank you.`;

export const customerAccounts = (customers: Customer[], bills: Invoice[], asOf = today()) => {
    const rows = receivableRows(bills, customers, asOf);
    return customers.map(customer => {
        const related = rows.filter(row => row.customer === customer._id);
        const active = related.filter(row => !row.cancellation && !row.creditNote);
        const total = (items: ReturnType<typeof receivableRows>, key: 'total' | 'balance') => items.reduce((sum, row) => sum + paise(row[key]), 0) / 100;
        return { ...customer, invoiceCount: related.length, invoiced: total(active, 'total'), outstanding: total(active, 'balance'),
            overdue: total(active.filter(row => row.overdueDays > 0), 'balance'), lastInvoice: related.map(row => row.date.slice(0, 10)).sort().pop() || null };
    });
};
