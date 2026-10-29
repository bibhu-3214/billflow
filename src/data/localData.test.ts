import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';

global.TextEncoder = TextEncoder;
Object.defineProperty(global, 'TextDecoder', {configurable: true, writable: true, value: TextDecoder});
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });

import localData from './browserData';

describe('secure local data', () => {
    test('retains customer billing defaults and catalog metadata through edits', async () => {
        const account = { username: 'Owner', email: 'profiles@example.com', password: 'StrongLocal#123', businessName: 'Shop', address: 'Mumbai' };
        await localData.register(account); await localData.login(account);
        const customer = await localData.addCustomer({ name: 'Buyer', email: 'buyer@example.com', mobile: '9876543210', company: 'Buyer Ltd', contactPerson: 'Ravi', address: 'Mumbai', gstin: '27AAPFU0939F1ZV', state: '27', notes: 'Internal only' });
        await localData.editCustomer(customer._id, { name: 'Updated buyer', email: customer.email, mobile: customer.mobile });
        expect((await localData.getCustomers())[0]).toMatchObject({ company: 'Buyer Ltd', gstin: '27AAPFU0939F1ZV', notes: 'Internal only' });
        await expect(localData.addCustomer({ ...customer, state: '29' })).rejects.toThrow('GSTIN');
        const product = await localData.addProduct({ name: 'Service', price: 100, sku: 'SVC-01', category: 'Consulting', description: 'Internal reference' });
        await localData.editProduct(product._id, { name: 'Updated service', price: 200 });
        expect((await localData.getProducts())[0]).toMatchObject({ sku: 'SVC-01', category: 'Consulting', description: 'Internal reference' });
    });
    test('round-trips encrypted backups without leaking profile, records or session keys', async () => {
        const account = { username: 'Backup owner', email: 'backup@example.com', password: 'StrongLocal#123', businessName: 'Private business', address: 'Mumbai' };
        await localData.register(account);
        await localData.login(account);
        await localData.saveSettings({ name: 'Private business', address: 'Mumbai', dueDays: 10 });
        const customer = await localData.addCustomer({ name: 'Private buyer', email: 'buyer@example.com', mobile: '9876543210' });
        const product = await localData.addProduct({ name: 'Private service', price: 100 });
        const input = { customer: customer._id, date: '2026-04-01', billingAddress: 'Mumbai', lineItems: [{ product: product._id, quantity: 1 }] };
        const bill = await localData.addBill(input);
        await localData.correctInvoice(bill._id, { action: 'credit', reason: 'Service cancelled' });
        const backup = await localData.exportBackup();
        for (const secret of ['Private business', 'Private buyer', account.email, 'workspaceKey', 'passwordVerifier', account.password]) expect(backup).not.toContain(secret);
        expect(await localData.previewBackup(backup, account.password)).toMatchObject({ customers: 1, products: 1, invoices: 1, email: account.email });
        const original = localStorage.getItem('billflow:database:v1');
        await expect(localData.restoreBackup(backup, account.password)).rejects.toThrow('already exists');
        await expect(localData.restoreBackup(backup, 'wrong')).rejects.toThrow('could not be opened');
        const damaged = JSON.parse(backup) as import('../types/domain').EncryptedBackup;
        damaged.payload.ciphertext = (damaged.payload.ciphertext[0] === 'A' ? 'B' : 'A') + damaged.payload.ciphertext.slice(1);
        await expect(localData.restoreBackup(JSON.stringify(damaged), account.password)).rejects.toThrow();
        expect(localStorage.getItem('billflow:database:v1')).toBe(original);
        localData.clearSession(); localStorage.clear();
        await localData.register({ ...account, email: 'other@example.com' });
        const otherBefore = JSON.parse(localStorage.getItem('billflow:database:v1')!) as import('../types/domain').BrowserDatabase;
        await localData.restoreBackup(backup, account.password);
        expect(localData.hasActiveSession()).toBe(false);
        const restored = JSON.parse(localStorage.getItem('billflow:database:v1')!) as import('../types/domain').BrowserDatabase;
        expect(restored.workspaces[otherBefore.users[0]._id]).toEqual(otherBefore.workspaces[otherBefore.users[0]._id]);
        await localData.login(account);
        expect((await localData.getSettings()).dueDays).toBe(10);
        expect((await localData.getBill(bill._id)).creditNote?.reason).toBe('Service cancelled');
        expect((await localData.addBill(input)).invoiceNumber).toBe('BF/2627/000002');
    });

    test('rejects unsupported backups and requires authentication to export', async () => {
        await expect(localData.exportBackup()).rejects.toThrow('expired');
        await expect(localData.restoreBackup('not json', 'password')).rejects.toThrow('JSON');
        await expect(localData.restoreBackup(JSON.stringify({ format: 'billflow-encrypted-backup', version: 99 }), 'password')).rejects.toThrow('Unsupported');
        expect(localStorage.getItem('billflow:database:v1')).toBeNull();
    });

    test('persists defaults and corrections while preserving snapshots and ledger history', async () => {
        await localData.register({ username: 'Owner', email: 'defaults@example.com', password: 'StrongLocal#123', businessName: 'Old business', address: 'Mumbai' });
        await localData.login({ email: 'defaults@example.com', password: 'StrongLocal#123' });
        await localData.saveSettings({ name: 'New business', address: 'New address', dueDays: 30, gstin: '27AAPFU0939F1ZV', state: '27', bankDetails: 'TEST BANK', terms: 'Net 30' });
        const customer = await localData.addCustomer({ name: 'Buyer', email: 'buyer@example.com', mobile: '9876543210' });
        const product = await localData.addProduct({ name: 'Service', price: 100, hsn: '9983', gstRate: 18, unit: 'HRS' });
        expect(product).toMatchObject({ hsn: '9983', gstRate: 18, unit: 'HRS' });
        expect((await localData.getSettings()).bankDetails).toBe('TEST BANK');
        const bill = await localData.addBill({ customer: customer._id, date: '2026-04-01', billingAddress: 'Mumbai', lineItems: [{ product: product._id, quantity: 1 }] });
        expect(bill.supplierSnapshot?.name).toBe('New business');
        await localData.saveSettings({ name: 'Later business', address: 'Another address', dueDays: 10 });
        expect((await localData.getBill(bill._id)).supplierSnapshot?.name).toBe('New business');
        const paid = await localData.recordPayment(bill._id, { amount: 50, date: '2026-04-02', method: 'UPI' });
        await expect(localData.correctInvoice(bill._id, { action: 'cancel', reason: 'Mistake' })).rejects.toThrow('Active payments');
        await localData.correctInvoice(bill._id, { action: 'reverse', paymentId: paid.payments![0]._id, reason: 'Entry error' });
        await expect(localData.correctInvoice(bill._id, { action: 'reverse', paymentId: paid.payments![0]._id, reason: 'Again' })).rejects.toThrow('already reversed');
        const credited = await localData.correctInvoice(bill._id, { action: 'credit', reason: 'Service withdrawn' });
        expect(credited.payments).toHaveLength(1);
        expect(credited.reversals).toHaveLength(1);
        expect(credited.creditNote?.amount).toBe(100);
        await expect(localData.recordPayment(bill._id, { amount: 1, date: '2026-04-02', method: 'Cash' })).rejects.toThrow('closed');
        await expect(localData.correctInvoice(bill._id, { action: 'cancel', reason: 'Again' })).rejects.toThrow('already closed');
        const nextBill = await localData.addBill({ customer: customer._id, date: '2026-04-01', billingAddress: 'Mumbai', lineItems: [{ product: product._id, quantity: 1 }] });
        await expect(localData.correctInvoice(nextBill._id, { action: 'cancel', reason: '' })).rejects.toThrow();
        const cancelled = await localData.correctInvoice(nextBill._id, { action: 'cancel', reason: 'Duplicate invoice' });
        expect(cancelled.cancellation?.reason).toBe('Duplicate invoice');
        expect(cancelled.lineItems).toEqual(nextBill.lineItems);
        await expect(localData.removeBill(nextBill._id)).rejects.toThrow('cannot be deleted');
        await expect(localData.saveSettings({ name: 'Bad', address: 'Bad', dueDays: -1 })).rejects.toThrow();
        await expect(localData.addProduct({ name: 'Bad', price: 1, gstRate: 99 })).rejects.toThrow();
    });
    test('issues unique invoices, retains snapshots, validates payments and protects issued records', async () => {
        await localData.register({ username: 'Business owner', email: 'invoice@example.com', password: 'StrongLocal#123', businessName: 'Example shop', address: 'Mumbai' });
        await localData.login({ email: 'invoice@example.com', password: 'StrongLocal#123' });
        const customer = await localData.addCustomer({ name: 'Buyer', email: 'buyer@example.com', mobile: '9876543210' });
        const product = await localData.addProduct({ name: 'Original name', price: 100 });
        const input = { customer: customer._id, date: '2026-04-01', dueDate: '2026-04-15', billingAddress: 'Mumbai', gst: true,
            supplierGSTIN: '27AAPFU0939F1ZV', supplierState: '27', placeOfSupply: '27', lineItems: [{ product: product._id, quantity: 2, discount: 10, gstRate: 18, hsn: '9983', unit: 'NOS' }] };
        const [first, second] = await Promise.all([localData.addBill(input), localData.addBill(input)]);
        expect(first.invoiceNumber).toBe('BF/2627/000001');
        expect(second.invoiceNumber).toBe('BF/2627/000002');
        expect(first.total).toBe(212.4);
        await localData.editProduct(product._id, { name: 'New name', price: 999 });
        await localData.editCustomer(customer._id, { name: 'New buyer', email: 'buyer@example.com', mobile: '9876543210' });
        const saved = await localData.getBill(first._id);
        expect(saved.lineItems[0].name).toBe('Original name');
        expect(saved.customerSnapshot?.name).toBe('Buyer');
        await expect(localData.removeBill(first._id)).rejects.toThrow('cannot be deleted');
        const payment = { amount: 100, method: 'UPI', date: '2026-04-02', reference: 'test' };
        await localData.recordPayment(first._id, payment);
        await expect(localData.recordPayment(first._id, { ...payment, amount: 113 })).rejects.toThrow('balance');
        await expect(localData.recordPayment(first._id, { ...payment, amount: -1 })).rejects.toThrow();
        await expect(localData.recordPayment(first._id, { ...payment, date: '2026-03-31' })).rejects.toThrow();
        expect((await localData.getBill(first._id)).payments).toHaveLength(1);
        expect((await localData.addBill({ ...input, date: '2027-04-01', dueDate: '2027-04-15' })).invoiceNumber).toBe('BF/2728/000001');
    });
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    test('demo edits are isolated from persistent accounts and reset after sign-out', async () => {
        const original = JSON.stringify({ users: [], workspaces: {} });
        localStorage.setItem('billflow:database:v1', original);
        await localData.openDemo();
        expect(localData.getCurrentUser().isDemo).toBe(true);
        expect(await localData.getCustomers()).toHaveLength(3);
        expect(await localData.getBills()).toHaveLength(6);
        await localData.addProduct({ name: 'Demo-only product', price: 25 });
        expect(await localData.getProducts()).toHaveLength(5);
        expect(localStorage.getItem('billflow:database:v1')).toBe(original);
        localData.clearSession();
        expect(sessionStorage.getItem('billflow:demo:v1')).toBeNull();
        await localData.openDemo();
        expect(await localData.getProducts()).toHaveLength(4);
    });

    test('invoice snapshots retain their price after catalog edits', async () => {
        await localData.openDemo();
        await expect(localData.exportBackup()).rejects.toThrow('Sample workspaces cannot be backed up');
        const product = await localData.addProduct({ name: 'Workshop', price: 125 });
        const customer = (await localData.getCustomers())[0];
        const bill = await localData.addBill({ date: '2026-10-09', customer: customer._id, billingAddress: 'Fictional billing address',
            lineItems: [{ product: product._id, quantity: 3 }] });
        await localData.editProduct(product._id, { name: 'Workshop', price: 200 });
        expect((await localData.getBill(bill._id)).total).toBe(375);
        await expect(localData.removeProduct(product._id)).rejects.toThrow('used by an invoice');
        await expect(localData.removeCustomer(customer._id)).rejects.toThrow('used by an invoice');
    });

    test('invalid quantities cannot create invoices', async () => {
        await localData.openDemo();
        const customer = (await localData.getCustomers())[0];
        const product = (await localData.getProducts())[0];
        for (const quantity of [0, -1, 1.5, 10001]) {
            await expect(localData.addBill({ date: '2026-10-09', customer: customer._id, billingAddress: 'Fictional billing address',
                lineItems: [{ product: product._id, quantity }] })).rejects.toThrow('invalid');
        }
        expect(await localData.getBills()).toHaveLength(6);
    });

    test('expired demo sessions reject workspace access', async () => {
        await localData.openDemo();
        const session = JSON.parse(sessionStorage.getItem('billflow:session:v2')!) as import('../types/domain').BrowserSession;
        session.expiresAt = Date.now() - 1;
        sessionStorage.setItem('billflow:session:v2', JSON.stringify(session));
        await expect(localData.getProducts()).rejects.toThrow('expired');
        expect(localData.hasActiveSession()).toBe(false);
    });

    test('encrypts workspace data and creates an expiring session', async () => {
        const password = 'StrongLocal#123';
        await localData.register({
            username: 'Test User',
            email: 'test@example.com',
            password,
            businessName: 'Test Business',
            address: 'Test Address',
        });

        const storedDatabase = JSON.parse(localStorage.getItem('billflow:database:v1')!) as import('../types/domain').BrowserDatabase;
        const user = storedDatabase.users[0];
        expect(user.passwordHash).toBeUndefined();
        expect(user.passwordSalt).toBeTruthy();
        expect(user.passwordVerifier).toBeTruthy();
        expect(storedDatabase.workspaces[user._id]).toEqual(
            expect.objectContaining({ version: 2, iv: expect.any(String) as unknown, ciphertext: expect.any(String) as unknown }),
        );
        expect(JSON.stringify(storedDatabase.workspaces[user._id])).not.toContain('customers');

        await localData.login({ email: 'test@example.com', password });
        expect(localData.hasActiveSession()).toBe(true);
        await localData.addProduct({ name: 'Secure product', price: 250 });
        expect(await localData.getProducts()).toEqual([
            expect.objectContaining({ name: 'Secure product', price: 250 }),
        ]);

        localData.clearSession();
        expect(localData.hasActiveSession()).toBe(false);
    });
});

export {};
