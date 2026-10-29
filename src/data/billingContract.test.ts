import fixtures from './billing-contract.json';
import { calculateInvoice } from '../utils/indiaBilling';

test.each(fixtures)('shared Python/web calculation: $name', fixture => {
    if (fixture.error) expect(() => calculateInvoice(fixture.items as unknown as import('../types/domain').InvoiceLineInput[], fixture.options)).toThrow();
    else expect(calculateInvoice(fixture.items as unknown as import('../types/domain').InvoiceLineInput[], fixture.options)).toMatchObject(fixture.expected!);
});
