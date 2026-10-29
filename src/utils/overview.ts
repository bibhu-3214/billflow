import type {Customer, Invoice} from '../types/domain';
import {receivableRows} from './receivables';
import Decimal from 'decimal.js';

export const totalAmounts = (values: readonly number[]) => values.reduce((sum, amount) => sum.plus(amount), new Decimal(0)).toDecimalPlaces(2).toNumber();
export function workspaceOverview(bills: Invoice[], customers: Customer[], asOf?: string) {
    const rows = receivableRows(bills, customers, asOf);
    const active = rows.filter(row => !row.cancellation && !row.creditNote);
    const open = rows.filter(row => row.balance > 0);
    const overdue = open.filter(row => row.overdueDays > 0).sort((a,b) => b.overdueDays - a.overdueDays || b.balance - a.balance);
    return {
        invoiced: totalAmounts(active.map(row => row.total)),
        paid: totalAmounts(rows.map(row => row.paid)),
        outstanding: totalAmounts(open.map(row => row.balance)),
        overdue: totalAmounts(overdue.map(row => row.balance)),
        activeCount: active.length, openCount: open.length, overdueRows: overdue,
        recent: [...rows].sort((a,b) => b.date.localeCompare(a.date) || b._id.localeCompare(a._id)).slice(0,5),
    };
}
