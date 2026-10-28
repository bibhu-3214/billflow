const { webcrypto } = require('crypto');
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
const { createCloudData } = require('./cloudData');

const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('lost write responses reuse their request key; separate successful actions get fresh keys', async () => {
    const requests = [];
    let fail = true;
    const cloud = createCloudData(async (path, options) => {
        if (path.endsWith('config')) return response({ csrfToken: 'csrf' });
        requests.push(options);
        if (fail) { fail = false; throw new TypeError('Network disconnected'); }
        return response({ _id: 'invoice' });
    });
    await expect(cloud.addBill({ lineItems: [] })).rejects.toThrow('Network');
    await cloud.addBill({ lineItems: [] });
    await cloud.addBill({ lineItems: [] });
    expect(requests[0].headers['Idempotency-Key']).toBe(requests[1].headers['Idempotency-Key']);
    expect(requests[2].headers['Idempotency-Key']).not.toBe(requests[1].headers['Idempotency-Key']);
    expect(requests[1].credentials).toBe('same-origin');
    expect(requests[1].headers['X-CSRFToken']).toBe('csrf');
});

test('hydrates identity from the server and refreshes CSRF after sign-in and sign-out', async () => {
    let configCount = 0;
    const calls = [];
    const cloud = createCloudData(async (path, options) => {
        calls.push([path, options]);
        if (path.endsWith('config')) return response({ csrfToken: 'csrf-' + ++configCount });
        if (path.endsWith('/me')) return response({ user: { _id: 'owner' } });
        if (path.endsWith('/auth/session')) return response({ status: 401, data: { flows: [{ id: 'login' }] } }, 401);
        return response({ status: 200 });
    });
    await cloud.login({ email: 'owner@example.com', password: 'Private' });
    expect(cloud.hasActiveSession()).toBe(true);
    await cloud.clearSession();
    expect(cloud.hasActiveSession()).toBe(false);
    expect(calls.find(([p]) => p.endsWith('/auth/session'))[1].headers['X-CSRFToken']).toBe('csrf-2');
    expect(calls.every(([, options]) => !options.headers?.Authorization)).toBe(true);
});

test('server validation conflicts retain their message and cannot fall back to local writes', async () => {
    const cloud = createCloudData(async path => path.endsWith('config') ? response({ csrfToken: 'csrf' }) : response({ detail: 'Stock changed. Reopen it.' }, 409));
    await expect(cloud.recordStockMovement({ revision: 1 })).rejects.toMatchObject({ status: 409, message: 'Stock changed. Reopen it.' });
});

test('a response arriving after sign-out cannot restore private data', async () => {
    let release;
    const cloud = createCloudData(async (path) => {
        if (path.endsWith('config')) return response({ csrfToken: 'csrf' });
        if (path.endsWith('/me')) return response({ user: { _id: 'owner' } });
        if (path.endsWith('/getCustomers')) return new Promise(resolve => { release = () => resolve(response([{ _id: 'private' }])); });
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
