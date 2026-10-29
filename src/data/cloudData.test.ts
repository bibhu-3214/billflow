import { webcrypto } from 'node:crypto';
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
import { createCloudData } from './cloudData';
import type { ResponseLike } from '../types/data';

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('lost write responses reuse their request key; separate successful actions get fresh keys', async () => {
    const requests: RequestInit[] = [];
    let fail = true;
    const cloud = createCloudData(async (path, options) => {
        if (path.endsWith('config')) return response({ csrfToken: 'csrf' });
        requests.push(options!);
        if (fail) { fail = false; throw new TypeError('Network disconnected'); }
        return response({ _id: 'invoice' });
    });
    await expect(cloud.addBill({ lineItems: [] })).rejects.toThrow('Network');
    await cloud.addBill({ lineItems: [] });
    await cloud.addBill({ lineItems: [] });
    expect((requests[0].headers as Record<string, string>)['Idempotency-Key']).toBe((requests[1].headers as Record<string, string>)['Idempotency-Key']);
    expect((requests[2].headers as Record<string, string>)['Idempotency-Key']).not.toBe((requests[1].headers as Record<string, string>)['Idempotency-Key']);
    expect(requests[1].credentials).toBe('same-origin');
    expect((requests[1].headers as Record<string, string>)['X-CSRFToken']).toBe('csrf');
});

test('hydrates identity from the server and refreshes CSRF after sign-in and sign-out', async () => {
    let configCount = 0;
    const calls: [string, RequestInit][] = [];
    const cloud = createCloudData(async (path, options) => {
        calls.push([path, options!]);
        if (path.endsWith('config')) return response({ csrfToken: 'csrf-' + ++configCount });
        if (path.endsWith('/me')) return response({ user: { _id: 'owner' } });
        if (path.endsWith('/auth/session')) return response({ status: 401, data: { flows: [{ id: 'login' }] } }, 401);
        return response({ status: 200 });
    });
    await cloud.login({ email: 'owner@example.com', password: 'Private' });
    expect(cloud.hasActiveSession()).toBe(true);
    await cloud.clearSession();
    expect(cloud.hasActiveSession()).toBe(false);
    expect((calls.find(([p]) => p.endsWith('/auth/session'))![1].headers as Record<string, string>)['X-CSRFToken']).toBe('csrf-2');
    expect(calls.every(([, options]) => !(options.headers as Record<string, string>)?.Authorization)).toBe(true);
});

test('server validation conflicts retain their message and cannot fall back to local writes', async () => {
    const cloud = createCloudData(async path => path.endsWith('config') ? response({ csrfToken: 'csrf' }) : response({ detail: 'Stock changed. Reopen it.' }, 409));
    await expect(cloud.recordStockMovement({ product: 'p', revision: 1 })).rejects.toMatchObject({ status: 409, message: 'Stock changed. Reopen it.' });
});

test('a response arriving after sign-out cannot restore private data', async () => {
    let release!: () => void;
    const cloud = createCloudData(async (path) => {
        if (path.endsWith('config')) return response({ csrfToken: 'csrf' });
        if (path.endsWith('/me')) return response({ user: { _id: 'owner' } });
        if (path.endsWith('/getCustomers')) return new Promise<ResponseLike>(resolve => { release = () => resolve(response([{ _id: 'private' }])); });
        if (path.endsWith('/auth/session')) return response({ status: 401, data: { flows: [{ id: 'login' }] } }, 401);
        return response({ status: 200 });
    });
    await cloud.initialize();
    const pending = cloud.getCustomers();
    await Promise.resolve(); await Promise.resolve();
    await cloud.clearSession();
    release();
    await expect(pending).rejects.toMatchObject({ cancelled: true });
    expect(cloud.hasActiveSession()).toBe(false);
});

test('a command awaiting config is cancelled before it can use a changed account cookie', async () => {
    let release!: () => void;
    const paths: string[] = [];
    const cloud = createCloudData(async path => {
        paths.push(path);
        if (path.endsWith('config')) return new Promise<ResponseLike>(resolve => { release = () => resolve(response({ csrfToken: 'old' })); });
        return response({ user: { _id: 'owner' } });
    });
    const pending = cloud.addProduct({ name: 'Old account intent', price: 10 });
    // Register the instance's cross-tab listener without awaiting its pending config.
    const initialization = cloud.initialize().catch(() => {});
    window.dispatchEvent(new StorageEvent('storage', { key: 'billflow:account-boundary:v1', newValue: 'changed' }));
    release();
    await expect(pending).rejects.toMatchObject({ cancelled: true });
    await initialization;
    expect(paths.some(path => path.includes('/actions/'))).toBe(false);
});

test('cross-tab sign-out immediately clears cached identity and notifies private views', async () => {
    const cloud = createCloudData(async path => path.endsWith('config') ? response({ csrfToken: 'csrf' }) : response({ user: { _id: 'owner' } }));
    await cloud.initialize();
    const expired = jest.fn();window.addEventListener('billflow:session-expired', expired);
    window.dispatchEvent(new StorageEvent('storage', { key: 'billflow:account-boundary:v1', newValue: 'logout' }));
    expect(cloud.hasActiveSession()).toBe(false);
    expect(() => cloud.getCurrentUser()).toThrow();
    expect(expired).toHaveBeenCalled();
    window.removeEventListener('billflow:session-expired', expired);
});


test('an expired response while hidden cannot permanently mask sign-in', async () => {
    let release!: () => void;
    const cloud = createCloudData(async path => {
        if (path.endsWith('config')) return response({ csrfToken: 'csrf' });
        if (path.endsWith('/me')) return response({ user: { _id: 'owner' } });
        return new Promise<ResponseLike>(resolve => { release = () => resolve(response({}, 401)); });
    });
    await cloud.initialize();
    const pending = cloud.getCustomers();
    await Promise.resolve();await Promise.resolve();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    release();await expect(pending).rejects.toMatchObject({ status: 401 });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(cloud.hasActiveSession()).toBe(false);
    expect(document.documentElement.hasAttribute('data-session-checking')).toBe(false);
});

export {};
