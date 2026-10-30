import {
    parseCustomerInsights,
    planHistoricalSales,
    validateHistoricalSales,
    historicalCustomerGroups,
} from './historicalSales';
const stamp = { createdAt: '2026-10-30T09:00:00.000Z', updatedAt: '2026-10-30T09:00:00.000Z' };
const row = { ...stamp, id: 'one', name: 'Buyer', phone: '123 456 7890', date: '2026-10-30', amountMinor: 29 };
const payload = {
    version: 1,
    product: 'customer-insights',
    records: [row, { ...row, id: 'two', phone: '1234567890', amountMinor: 71 }],
};
const customer = { _id: 'c1', name: 'Buyer', mobile: '1234567890', email: 'buyer@example.test' };
test('historical imports preserve paise and explicit links without inferring invoice data', () => {
    const plan = planHistoricalSales(payload, [], [customer], { '1234567890': 'c1' });
    expect(plan.records[0]).toEqual({
        ...stamp,
        _id: 'insight_one',
        source: 'customer-insights',
        sourceId: 'one',
        name: 'Buyer',
        phone: row.phone,
        date: row.date,
        amountMinor: 29,
        customerId: 'c1',
    });
    expect(historicalCustomerGroups(plan.records)).toMatchObject([{ amountMinor: 100, count: 2, customerId: 'c1' }]);
    expect(validateHistoricalSales(plan.records, [customer])).toEqual(plan.records);
    expect(planHistoricalSales(payload, plan.records, [customer], {})).toEqual({
        records: [],
        duplicates: 2,
        sourceCount: 2,
    });
    expect(planHistoricalSales(payload, [], [customer], {}).records.every((sale) => sale.customerId === '')).toBe(true);
});
test('rejects wrong products, duplicate source IDs, invalid dates, noninteger amounts and foreign links', () => {
    for (const patch of [
        { date: '2026-02-30' },
        { amountMinor: 0.29 },
        { amountMinor: -1 },
        { createdAt: 'yesterday' },
        { source: 'injected' },
    ])
        expect(() => parseCustomerInsights({ ...payload, records: [{ ...row, ...patch }] })).toThrow();
    expect(() => parseCustomerInsights({ ...payload, product: 'task-workspace' })).toThrow();
    expect(() => parseCustomerInsights({ ...payload, records: [row, row] })).toThrow();
    expect(() => planHistoricalSales(payload, [], [customer], { '1234567890': 'other-account' })).toThrow();
    const imported = planHistoricalSales(payload, [], [customer], { '1234567890': 'c1' }).records;
    expect(() => validateHistoricalSales(imported, [])).toThrow();
});
