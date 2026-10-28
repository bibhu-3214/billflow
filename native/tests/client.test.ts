import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, validateOrigin } from '../src/client';

const uuid = () => '4c0cf7ca-f423-47cb-9bcd-3a50d65571cd';
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

test('origins reject cleartext production, credentials, paths and local network hosts', () => {
    for (const origin of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'http://192.168.1.5']) assert.throws(() => validateOrigin(origin));
    assert.equal(validateOrigin('http://127.0.0.1:8001', true), 'http://127.0.0.1:8001');
    assert.equal(validateOrigin('https://service.example.com/'), 'https://service.example.com');
});

test('expired sessions clear the device token; a lost command response retains its key', async () => {
    let stored: string | null = 'private-token';
    const calls: RequestInit[] = [];
    let fail = true;
    const client = new Client('https://service.example.com', { get: async () => stored, set: async token => { stored = token; }, clear: async () => { stored = null; } }, uuid,
        (async (_path, init) => { calls.push(init!); if (fail) { fail = false; throw new Error('Disconnected'); } return response({ _id: 'invoice' }); }) as typeof fetch);
    await client.restore();
    await assert.rejects(client.command('addBill', [{}]), /Disconnected/);
    await client.command('addBill', [{}]);
    assert.equal((calls[0].headers as Record<string, string>)['Idempotency-Key'], (calls[1].headers as Record<string, string>)['Idempotency-Key']);
    assert.equal((calls[0].headers as Record<string, string>)['X-Session-Token'], 'private-token');
    const expired = new Client('https://service.example.com', { get: async () => stored, set: async () => {}, clear: async () => { stored = null; } }, uuid, (async () => response({}, 401)) as typeof fetch);
    await expired.restore();
    await assert.rejects(expired.workspace(), /expired/);
    assert.equal(stored, null);
});
