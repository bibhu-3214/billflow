import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
global.TextEncoder = TextEncoder; Object.defineProperty(global, 'TextDecoder', {configurable: true, writable: true, value: TextDecoder});
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
import { encryptPortableBackup, migrationPayload } from './browserData';

test('connected exports decrypt with a separate password and retain long business addresses', async () => {
    const profile = { _id: 'cloud-owner', username: 'Cloud owner', email: 'cloud@example.test', businessName: 'Cloud shop', address: 'A'.repeat(400) };
    const state = { customers: [], products: [], bills: [], settings: { name: 'Cloud shop', address: profile.address } };
    const password = 'SeparateBackup#4828';
    const backup = await encryptPortableBackup({invoiceDrafts: [], quotations: [], invoiceTemplates: [], stockRecords: [], followUps: [], invoiceSequences: {}, quotationSequence: 0, ...state}, profile, password);
    expect(backup).not.toContain(profile.email);
    expect(backup).not.toContain(password);
    const result = await migrationPayload(backup, password);
    expect(result.workspace).toMatchObject(state);
    expect(result.profile.address).toBe(profile.address);
    await expect(migrationPayload(backup, 'WrongPassword#12')).rejects.toThrow('could not be opened');
});

export {};
