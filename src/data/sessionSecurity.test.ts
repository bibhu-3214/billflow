import { webcrypto } from 'node:crypto';
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
import browser from './browserData';

const account = (n: number) => ({ username: 'Owner '+n, email: `owner${n}@example.test`, password: 'PrivateLocal#4279', businessName: 'Business '+n, address: 'Mumbai' });
const holdCrypto = (method: 'encrypt' | 'decrypt') => {
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    const original = webcrypto.subtle[method].bind(webcrypto.subtle);
    jest.spyOn(webcrypto.subtle, method).mockImplementationOnce(async (...args) => {
        const result = await original(args[0], args[1], args[2]); started(); await gate; return result;
    });
    return { release, ready };
};
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); browser.clearSession(); });
afterEach(() => jest.restoreAllMocks());

test('a delayed demo write after logout cannot replace persistent accounts', async () => {
    await browser.register(account(1));
    const original = localStorage.getItem('billflow:database:v1');
    await browser.openDemo();
    const hold = holdCrypto('encrypt');
    const pending = browser.addProduct({ name: 'Late sample', price: 100 });
    await hold.ready; browser.clearSession(); hold.release();
    await expect(pending).rejects.toMatchObject({ cancelled: true });
    expect(localStorage.getItem('billflow:database:v1')).toBe(original);
    expect(sessionStorage.getItem('billflow:demo:v1')).toBeNull();
});

test('a private read finishing after logout returns no plaintext', async () => {
    await browser.register(account(1)); await browser.login(account(1));
    const hold = holdCrypto('decrypt');
    const pending = browser.getSettings();
    await hold.ready; browser.clearSession(); hold.release();
    await expect(pending).rejects.toMatchObject({ cancelled: true });
});

test('queued account-A writes never execute under account B', async () => {
    await browser.register(account(1)); await browser.register(account(2));
    await browser.login(account(1));
    const hold = holdCrypto('encrypt');
    const first = browser.addProduct({ name: 'Pending A', price: 10 });
    const queued = browser.addProduct({ name: 'Queued A', price: 20 });
    const outcomes = Promise.allSettled([first, queued]);
    await hold.ready; browser.clearSession(); await browser.login(account(2)); hold.release();
    for (const result of await outcomes) expect(result).toMatchObject({ status: 'rejected', reason: { cancelled: true } });
    expect(await browser.getProducts()).toEqual([]);
    browser.clearSession(); await browser.login(account(1));
    expect(await browser.getProducts()).toEqual([]);
});

export {};
