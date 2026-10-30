import type { Customer, HistoricalSale, HistoricalSalesPreview, Workspace } from '../types/domain';
import { validDate } from './indiaBilling';
export interface SourcePurchase {
    id: string;
    name: string;
    phone: string;
    date: string;
    amountMinor: number;
    createdAt: string;
    updatedAt: string;
}
const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const stamp = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length <= 40 &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
export const phoneKey = (value: string) => value.replace(/[ ()-]/g, '');
export function parseCustomerInsights(payload: unknown): SourcePurchase[] {
    if (
        !object(payload) ||
        Object.keys(payload).sort().join(',') !== 'product,records,version' ||
        payload.version !== 1 ||
        !['customer-insights', 'customer-desk'].includes(String(payload.product)) ||
        !Array.isArray(payload.records) ||
        payload.records.length > 10000
    )
        throw new Error('Choose a Customer Insights JSON export with up to 10,000 purchases.');
    const seen = new Set<string>();
    return payload.records.map((row: unknown) => {
        if (
            !object(row) ||
            Object.keys(row).sort().join(',') !== 'amountMinor,createdAt,date,id,name,phone,updatedAt' ||
            typeof row.id !== 'string' ||
            !/^[A-Za-z0-9_-]{1,80}$/.test(row.id) ||
            seen.has(row.id) ||
            typeof row.name !== 'string' ||
            !row.name.trim() ||
            row.name.trim().length > 100 ||
            typeof row.phone !== 'string' ||
            !/^\+?[\d ()-]{7,25}$/.test(row.phone) ||
            row.phone.replace(/\D/g, '').length < 7 ||
            row.phone.replace(/\D/g, '').length > 15 ||
            typeof row.date !== 'string' ||
            !validDate(row.date) ||
            typeof row.amountMinor !== 'number' ||
            !Number.isSafeInteger(row.amountMinor) ||
            row.amountMinor < 1 ||
            row.amountMinor > 100_000_000_000 ||
            !stamp(row.createdAt) ||
            !stamp(row.updatedAt)
        )
            throw new Error('The export contains an invalid or duplicate historical purchase.');
        seen.add(row.id);
        return {
            id: row.id,
            name: row.name.trim(),
            phone: row.phone.trim(),
            date: row.date,
            amountMinor: row.amountMinor,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    });
}
export function planHistoricalSales(
    payload: unknown,
    current: readonly HistoricalSale[],
    customers: readonly Customer[],
    links: Record<string, string>
) {
    const source = parseCustomerInsights(payload),
        phones = new Set(source.map((row) => phoneKey(row.phone))),
        ids = new Set(customers.map((customer) => customer._id));
    if (
        Object.entries(links).some(
            ([phone, customer]) =>
                !phones.has(phone) || typeof customer !== 'string' || (customer && !ids.has(customer))
        )
    )
        throw new Error('A selected customer is unavailable in this business.');
    const existing = new Set(current.map((row) => row._id));
    let duplicates = 0;
    const records: HistoricalSale[] = [];
    for (const row of source) {
        const id = 'insight_' + row.id;
        if (existing.has(id)) {
            duplicates++;
            continue;
        }
        records.push({
            _id: id,
            source: 'customer-insights',
            sourceId: row.id,
            name: row.name,
            phone: row.phone,
            date: row.date,
            amountMinor: row.amountMinor,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            customerId: links[phoneKey(row.phone)] || '',
        });
    }
    if (current.length + records.length > 10000) throw new Error('The historical sales limit is 10,000 records.');
    return { records, sourceCount: source.length, duplicates };
}
export function validateHistoricalSales(rows: unknown, customers: readonly Customer[]): HistoricalSale[] {
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Invalid historical sales collection.');
    const ids = new Set(customers.map((customer) => customer._id));
    const source = rows.map((row: unknown) => {
        if (
            !object(row) ||
            Object.keys(row).sort().join(',') !==
                '_id,amountMinor,createdAt,customerId,date,name,phone,source,sourceId,updatedAt' ||
            typeof row.sourceId !== 'string' ||
            row.source !== 'customer-insights' ||
            row._id !== 'insight_' + row.sourceId ||
            typeof row.customerId !== 'string' ||
            (row.customerId && !ids.has(row.customerId))
        )
            throw new Error('A historical sale has an invalid identity or customer link.');
        return {
            id: row.sourceId,
            name: row.name,
            phone: row.phone,
            date: row.date,
            amountMinor: row.amountMinor,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    });
    parseCustomerInsights({ version: 1, product: 'customer-insights', records: source });
    return rows as HistoricalSale[];
}
export function historyFingerprint(
    workspace: Workspace,
    owner: string,
    payload: unknown,
    links: Record<string, string>
) {
    return JSON.stringify([
        owner,
        workspace.historicalSales || [],
        workspace.customers.map((customer) => customer._id).sort(),
        payload,
        links,
    ]);
}
export function historicalCustomerGroups(rows: readonly HistoricalSale[]) {
    const groups = new Map<
        string,
        {
            name: string;
            phone: string;
            customerId: string;
            count: number;
            amountMinor: number;
            lastPurchase: string;
            records: HistoricalSale[];
        }
    >();
    for (const row of rows) {
        const key = row.customerId ? 'customer:' + row.customerId : 'phone:' + phoneKey(row.phone);
        const group = groups.get(key) || {
            name: row.name,
            phone: row.phone,
            customerId: row.customerId,
            count: 0,
            amountMinor: 0,
            lastPurchase: '',
            records: [],
        };
        group.count++;
        group.amountMinor += row.amountMinor;
        group.lastPurchase = group.lastPurchase > row.date ? group.lastPurchase : row.date;
        group.records.push(row);
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor);
}
export type HistoricalSalesReview = HistoricalSalesPreview;
