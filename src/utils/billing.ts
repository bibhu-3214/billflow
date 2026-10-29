import type { Invoice } from '../types/domain';
import moment from 'moment';
import Decimal from 'decimal.js';

export const getMonthlySales = (bills: (Pick<Invoice, 'date' | 'cancellation' | 'creditNote'> & {total: number | string})[], monthCount = 6, now = moment()): [string, number][] => {
    const months = Array.from({ length: monthCount }, (_, index) =>
        now.clone().subtract(monthCount - index - 1, 'months').startOf('month'),
    );

    return months.map(month => {
        const total = bills.reduce((sum, bill) => {
            const billDate = moment(bill.date);
            return !bill.cancellation && !bill.creditNote && billDate.isSame(month, 'month') ? sum.plus(bill.total || 0) : sum;
        }, new Decimal(0));

        return [month.format('MMM YYYY'), total.toDecimalPlaces(2).toNumber()];
    });
};
