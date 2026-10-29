import moment from 'moment';
import { getMonthlySales } from './billing';

describe('getMonthlySales', () => {
    test('groups sales across a year boundary', () => {
        const bills = [
            { date: '2025-12-15', total: 25 },
            { date: '2026-01-10', total: '75' },
            { date: '2025-01-10', total: 999 },
        ];

        expect(getMonthlySales(bills, 2, moment('2026-01-20'))).toEqual([
            ['Dec 2025', 25],
            ['Jan 2026', 75],
        ]);
    });
});

test('monthly totals retain paise and exclude cancelled and credited invoices',()=>{
    const bills=[{date:'2026-01-01',total:0.1},{date:'2026-01-02',total:'0.2'},{date:'2026-01-03',total:50,cancellation:{date:'2026-01-04',reason:'Void'}},{date:'2026-01-04',total:100,creditNote:{date:'2026-01-05',reason:'Return',number:'CN1',amount:100}}];
    expect(getMonthlySales(bills,1,moment('2026-01-20'))).toEqual([['Jan 2026',0.3]]);
});
