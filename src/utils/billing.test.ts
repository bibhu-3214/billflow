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
