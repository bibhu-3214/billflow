import fixtures from './billing-contract.json';
import { calculateInvoice } from '../utils/indiaBilling';

test.each(fixtures)('shared Python/web calculation: $name', fixture => {
    if (fixture.error) expect(() => calculateInvoice(fixture.items, fixture.options)).toThrow();
    else expect(calculateInvoice(fixture.items, fixture.options)).toMatchObject(fixture.expected);
});
