import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
global.TextEncoder = TextEncoder;
Object.defineProperty(global, 'TextDecoder', {configurable: true, writable: true, value: TextDecoder});
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
import localData from './browserData';
import { today } from '../utils/indiaBilling';

const rewriteBackup = async (text: string, password: string, update: (workspace: import('../types/domain').Workspace) => void) => {
    const backup = JSON.parse(text) as import('../types/domain').EncryptedBackup;
    const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt: Buffer.from(backup.salt, 'base64'), iterations: 310000, hash: 'SHA-256' }, material, 512);
    const key = await webcrypto.subtle.importKey('raw', new Uint8Array(bits).slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(backup.payload.iv, 'base64') }, key, Buffer.from(backup.payload.ciphertext, 'base64'));
    const contents = JSON.parse(new TextDecoder().decode(plain)) as Omit<import('../types/domain').BackupContents, 'workspace'> & {workspace: import('../types/domain').Workspace};
    update(contents.workspace);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(contents)));
    return JSON.stringify({ ...backup, payload: { version: 2, iv: Buffer.from(iv).toString('base64'), ciphertext: Buffer.from(ciphertext).toString('base64') } });
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
test('manual stock records counts, thresholds and reasons without changing invoice operations', async () => {
    const { input, product } = await setup();
    expect(await localData.getStockRecords()).toEqual([]);
    const opening = await localData.recordStockMovement({ product: product._id, revision: 0, type: 'opening', delta: 10, reorderLevel: 3, reason: 'Physical count' });
    const reduced = await localData.recordStockMovement({ product: product._id, revision: opening.revision, type: 'adjustment', delta: -8, reorderLevel: 3, reason: 'Damaged units removed' });
    expect(reduced).toMatchObject({ onHand: 2, reorderLevel: 3, revision: 2 });
    expect(reduced.movements).toHaveLength(2);
    await localData.addBill(input);
    expect((await localData.getStockRecords())[0].onHand).toBe(2);
    await expect(localData.removeProduct(product._id)).rejects.toThrow('stock history');
    const threshold = await localData.recordStockMovement({ product: product._id, revision: 2, type: 'threshold', delta: 0, reorderLevel: 1, reason: 'Revised replenishment policy' });
    expect(threshold.onHand).toBe(2); expect(threshold.movements[2].reorderLevel).toBe(1);
});
test('stock changes reject stale counts, negative balances, invalid units and failed writes', async () => {
    const { product } = await setup();
    const values = { product: product._id, revision: 0, type: 'opening', delta: 5, reorderLevel: 1, reason: 'Opening count' };
    await expect(localData.recordStockMovement({ ...values, delta: 1.5 })).rejects.toThrow('whole-unit');
    await expect(localData.recordStockMovement({ ...values, reason: '' })).rejects.toThrow('reason');
    await localData.recordStockMovement(values);
    await expect(localData.recordStockMovement(values)).rejects.toThrow('changed');
    await expect(localData.recordStockMovement({ ...values, revision: 1, type: 'adjustment', delta: -6 })).rejects.toThrow('negative');
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    try { await expect(localData.recordStockMovement({ ...values, revision: 1, type: 'adjustment', delta: 2 })).rejects.toThrow('Storage full'); }
    finally { storage.mockRestore(); }
    expect((await localData.getStockRecords())[0]).toMatchObject({ revision: 1, onHand: 5 });
    await localData.editProduct(product._id, { name: product.name, price: product.price, unit: 'BOX' });
    await expect(localData.recordStockMovement({ ...values, revision: 1, type: 'adjustment', delta: 2 })).rejects.toThrow('unit differs');
});
test('follow-ups validate customer/date, retain outcomes, reject stale editors and can be reopened', async () => {
    const { customer } = await setup();
    const input = { customer: customer._id, title: 'Confirm next order', dueDate: today(), channel: 'Phone', purpose: 'Order enquiry', priority: 'High', notes: 'Internal context' };
    await expect(localData.saveFollowUp({ ...input, customer: 'missing' })).rejects.toThrow('customer');
    await expect(localData.saveFollowUp({ ...input, dueDate: '2026-02-30' })).rejects.toThrow('date');
    const task = await localData.saveFollowUp(input);
    expect(sessionStorage.getItem('billflow:demo:v1')).not.toContain('Internal context');
    const updated = await localData.saveFollowUp({ ...input, title: 'Check replenishment' }, task._id, 1);
    await expect(localData.setFollowUpStatus(task._id, 1, 'completed', 'Confirmed')).rejects.toThrow('changed');
    await expect(localData.setFollowUpStatus(task._id, 2, 'completed', '')).rejects.toThrow('Outcome');
    const completed = await localData.setFollowUpStatus(task._id, updated.revision, 'completed', 'Buyer confirmed order');
    expect(completed.history[2]).toMatchObject({ action: 'completed', outcome: 'Buyer confirmed order' });
    await expect(localData.saveFollowUp(input, task._id, 3)).rejects.toThrow('Reopen');
    const reopened = await localData.setFollowUpStatus(task._id, 3, 'open', 'Buyer requested another call');
    expect(reopened).toMatchObject({ revision: 4, status: 'open' }); expect(reopened.history).toHaveLength(4);
});
test('failed follow-up storage writes preserve the task and its revision', async () => {
    const { customer } = await setup();
    const task = await localData.saveFollowUp({ customer: customer._id, title: 'Payment conversation', dueDate: today(), channel: 'Phone', purpose: 'Collection', priority: 'Normal' });
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    try { await expect(localData.setFollowUpStatus(task._id, 1, 'completed', 'Paid externally')).rejects.toThrow('Storage full'); }
    finally { storage.mockRestore(); }
    expect((await localData.getFollowUps())[0]).toMatchObject({ status: 'open', revision: 1 });
});
test('quotations freeze offers, require acceptance and convert atomically once at quoted prices', async () => {
    const { input, product } = await setup();
    const count = (await localData.getBills()).length;
    const quote = await localData.saveQuotation(input);
    expect(quote.number).toBe('QT/2627/000001');
    expect(await localData.getBills()).toHaveLength(count);
    await expect(localData.addBill({ quotationId: quote._id, quotationRevision: 1, date: today(), dueDate: today() })).rejects.toThrow('accepted');
    const accepted = await localData.setQuotationStatus(quote._id, 1, 'accepted');
    await expect(localData.setQuotationStatus(quote._id, 1, 'rejected')).rejects.toThrow('changed');
    await localData.editProduct(product._id, { name: 'Changed catalog name', price: product.price + 100 });
    const values = { quotationId: quote._id, quotationRevision: accepted.revision, date: today(), dueDate: today(), lineItems: [{ price: 1, quantity: 99999 }], customer: 'FORGED' };
    const [invoice, retry] = await Promise.all([localData.addBill(values), localData.addBill(values)]);
    expect(invoice._id).toBe(retry._id);
    expect(invoice.lineItems[0]).toMatchObject({ name: product.name, price: product.price });
    expect(invoice.customerSnapshot?.name).toBe(quote.customerSnapshot?.name);
    expect(invoice.sourceQuotationId).toBe(quote._id);
    expect(invoice.sourceQuotationNumber).toBe(quote.number);
    expect(await localData.getBills()).toHaveLength(count + 1);
    expect((await localData.getQuotations())[0]).toMatchObject({ status: 'converted', invoiceId: invoice._id });
});

test('rejects invalid, expired and rejected offers and leaves failed conversions unchanged', async () => {
    const { input } = await setup();
    await expect(localData.saveQuotation({ ...input, lineItems: [] })).rejects.toThrow('product');
    await expect(localData.saveQuotation({ ...input, dueDate: '2025-01-01' })).rejects.toThrow('dates');
    const expired = await localData.saveQuotation({ ...input, date: '2025-01-01', dueDate: '2025-01-02' });
    await expect(localData.setQuotationStatus(expired._id, 1, 'accepted')).rejects.toThrow('expired');
    const rejected = await localData.saveQuotation(input);
    await localData.setQuotationStatus(rejected._id, 1, 'rejected');
    await expect(localData.addBill({ quotationId: rejected._id, quotationRevision: 2, date: today(), dueDate: today() })).rejects.toThrow('accepted');
    const quote = await localData.saveQuotation(input);
    await localData.setQuotationStatus(quote._id, 1, 'accepted');
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    try { await expect(localData.addBill({ quotationId: quote._id, quotationRevision: 2, date: today(), dueDate: today() })).rejects.toThrow('Storage full'); }
    finally { storage.mockRestore(); }
    expect((await localData.getQuotations()).find(record => record._id === quote._id)?.status).toBe('accepted');
    expect((await localData.addBill({ quotationId: quote._id, quotationRevision: 2, date: today(), dueDate: today() })).invoiceNumber).toBe('BF/2627/000001');
});

test('templates retain only bounded item bundles and create fresh drafts at current prices', async () => {
    const { input, product } = await setup();
    const forgedInput = { ...input, invoiceNumber: 'FORGED' };
    const template = await localData.saveInvoiceTemplate(forgedInput);
    for (const key of ['customer', 'date', 'invoiceNumber']) expect(template).not.toHaveProperty(key);
    await localData.editProduct(product._id, { name: product.name, price: product.price + 100 });
    const first = await localData.draftFromTemplate(template._id);
    const second = await localData.draftFromTemplate(template._id);
    expect(first._id).not.toBe(second._id);
    expect(first).toMatchObject({ customer: '', date: today(), dueDate: '', billingAddress: '', customerGSTIN: '', placeOfSupply: '' });
    expect(first.lineItems[0].price).toBe(product.price + 100);
    await localData.removeInvoiceTemplate(template._id);
    expect(await localData.getInvoiceDrafts()).toHaveLength(2);
    await expect(localData.draftFromTemplate(template._id)).rejects.toThrow('no longer available');
    await expect(localData.saveInvoiceTemplate({ title: 'Empty', lineItems: [] })).rejects.toThrow('product');
    const extra = await localData.addProduct({ name: 'Obsolete bundle', price: 10 });
    const orphan = await localData.saveInvoiceTemplate({ title: 'Old item', lineItems: [{ product: extra._id, quantity: 1 }] });
    await localData.removeProduct(extra._id);
    await expect(localData.draftFromTemplate(orphan._id)).rejects.toThrow('unavailable');
});

test('quotation and template backups preserve snapshots and reject corrupt histories', async () => {
    const account = { username: 'Shop owner', email: 'offers@example.test', password: 'StrongLocal#123', businessName: 'Retail shop', address: 'Mumbai' };
    await localData.register(account); await localData.login(account);
    const customer = await localData.addCustomer({ name: 'Trade buyer', email: 'buyer@example.test', mobile: '9000000000', address: 'Mumbai' });
    const product = await localData.addProduct({ name: 'Cartons', price: 100 });
    const input = { title: 'Carton offer', customer: customer._id, date: today(), dueDate: today(), billingAddress: 'Mumbai', lineItems: [{ product: product._id, price: 100, quantity: 2, unit: 'NOS' }] };
    const quote = await localData.saveQuotation(input); await localData.saveInvoiceTemplate(input);
    await localData.recordStockMovement({ product: product._id, revision: 0, type: 'opening', delta: 5, reorderLevel: 2, reason: 'Opening physical count' });
    await localData.saveFollowUp({ customer: customer._id, title: 'Next trade order', dueDate: today(), channel: 'Phone', purpose: 'Order enquiry', priority: 'Normal' });
    await localData.editProduct(product._id, { name: 'Cartons', price: 200 });
    const backup = await localData.exportBackup();
    expect(await localData.previewBackup(backup, account.password)).toMatchObject({ quotations: 1, templates: 1, trackedProducts: 1, followUps: 1 });
    const badStock = await rewriteBackup(backup, account.password, workspace => { workspace.stockRecords[0].onHand = 50; });
    await expect(localData.previewBackup(badStock, account.password)).rejects.toThrow('balance');
    const corrupt = await rewriteBackup(backup, account.password, workspace => { workspace.quotations[0].lineItems[0].price = -1; });
    await expect(localData.previewBackup(corrupt, account.password)).rejects.toThrow('price');
    const missingSequence = await rewriteBackup(backup, account.password, workspace => { Reflect.deleteProperty(workspace, "quotationSequence"); });
    await expect(localData.previewBackup(missingSequence, account.password)).rejects.toThrow('sequence');
    localData.clearSession(); localStorage.clear(); await localData.restoreBackup(backup, account.password); await localData.login(account);
    expect((await localData.getQuotations())[0].lineItems[0].price).toBe(100);
    expect((await localData.getQuotations())[0]._id).toBe(quote._id);
    expect((await localData.getStockRecords())[0].onHand).toBe(5); expect((await localData.getFollowUps())[0].title).toBe('Next trade order');
    const legacy = await rewriteBackup(backup, account.password, workspace => { Reflect.deleteProperty(workspace, "quotations"); Reflect.deleteProperty(workspace, "invoiceTemplates"); Reflect.deleteProperty(workspace, "quotationSequence"); Reflect.deleteProperty(workspace, "stockRecords"); Reflect.deleteProperty(workspace, "followUps"); });
    localData.clearSession(); localStorage.clear(); await localData.restoreBackup(legacy, account.password); await localData.login(account);
    expect(await localData.getQuotations()).toEqual([]); expect(await localData.getInvoiceTemplates()).toEqual([]);
    expect(await localData.getStockRecords()).toEqual([]); expect(await localData.getFollowUps()).toEqual([]);
});
const setup = async () => {
    await localData.openDemo();
    const customer = (await localData.getCustomers())[0];
    const product = (await localData.getProducts())[0];
    return { customer, product, input: { title: 'Counter order · Test retailer', customer: customer._id,
        date: today(), dueDate: today(), gst: false, billingAddress: 'Fictional address', notes: 'Collect at counter',
        lineItems: [{ product: product._id, price: product.price, quantity: 2, discount: 10, unit: 'NOS' }] } };
};

test('saves incomplete drafts encrypted, strips issue-only fields and allocates no invoice number', async () => {
    await localData.openDemo();
    const count = (await localData.getBills()).length;
    const forgedInput = { title: 'Private pending order', lineItems: [], invoiceNumber: 'FORGED', total: 999, payments: [{ amount: 999 }] };
    const draft = await localData.saveInvoiceDraft(forgedInput);
    expect(draft).toMatchObject({ revision: 1, customer: '', lineItems: [], title: 'Private pending order' });
    for (const key of ['invoiceNumber', 'total', 'payments']) expect(draft).not.toHaveProperty(key);
    expect(sessionStorage.getItem('billflow:demo:v1')).not.toContain('Private pending order');
    expect(await localData.getInvoiceDrafts()).toHaveLength(1);
    expect(await localData.getBills()).toHaveLength(count);
});

test('rejects stale revisions and serializes competing saves without losing newer work', async () => {
    const { input } = await setup();
    const draft = await localData.saveInvoiceDraft(input);
    const attempts = await Promise.allSettled([
        localData.saveInvoiceDraft({ ...input, title: 'First editor' }, draft._id, draft.revision),
        localData.saveInvoiceDraft({ ...input, title: 'Stale editor' }, draft._id, draft.revision),
    ]);
    expect(attempts[0].status).toBe('fulfilled'); expect(attempts[1].status).toBe('rejected');
    const saved = (await localData.getInvoiceDrafts())[0];
    expect(saved).toMatchObject({ title: 'First editor', revision: 2 });
    await expect(localData.removeInvoiceDraft(saved._id, 1)).rejects.toThrow('changed');
    await expect(localData.duplicateInvoiceDraft(saved._id, 1)).rejects.toThrow('changed');
});

test('issues and consumes a draft atomically, making retries idempotent and numbering continuous', async () => {
    const { input } = await setup();
    const draft = await localData.saveInvoiceDraft(input);
    const count = (await localData.getBills()).length;
    const issue = { ...input, draftId: draft._id, draftRevision: draft.revision };
    await expect(localData.addBill({ ...issue, billingAddress: '' })).rejects.toThrow('Billing address');
    expect(await localData.getInvoiceDrafts()).toHaveLength(1);
    const [first, retry] = await Promise.all([localData.addBill(issue), localData.addBill(issue)]);
    expect(first._id).toBe(retry._id); expect(first.invoiceNumber).toBe('BF/2627/000001');
    expect(first.sourceDraftId).toBe(draft._id);
    expect(await localData.getInvoiceDrafts()).toHaveLength(0);
    expect(await localData.getBills()).toHaveLength(count + 1);
    await expect(localData.saveInvoiceDraft(input, draft._id, draft.revision)).rejects.toThrow('no longer available');
    expect((await localData.addBill(input)).invoiceNumber).toBe('BF/2627/000002');
});

test('rejects stale issuance, changed catalog prices and removed references without consuming drafts', async () => {
    const { input, product, customer } = await setup();
    const draft = await localData.saveInvoiceDraft(input);
    await localData.saveInvoiceDraft({ ...input, notes: 'New terms' }, draft._id, draft.revision);
    await expect(localData.addBill({ ...input, draftId: draft._id, draftRevision: 1 })).rejects.toThrow('changed');
    await localData.editProduct(product._id, { name: product.name, price: product.price + 100 });
    await expect(localData.addBill({ ...input, draftId: draft._id, draftRevision: 2 })).rejects.toThrow('price changed');
    expect(await localData.getInvoiceDrafts()).toHaveLength(1);
    // Unreferenced records can be removed; drafts must then require replacement.
    const extra = await localData.addProduct({ name: 'Disposable item', price: 25 });
    const orphan = await localData.saveInvoiceDraft({ ...input, customer: customer._id, lineItems: [{ product: extra._id, quantity: 1 }] });
    await localData.removeProduct(extra._id);
    await expect(localData.saveInvoiceDraft(orphan, orphan._id, orphan.revision)).rejects.toThrow('unavailable');
    await expect(localData.addBill({ ...orphan, draftId: orphan._id, draftRevision: 1 })).rejects.toThrow('invalid');
});

test('duplicates with new identifiers and dates, permits confirmed deletion and bounds draft inputs', async () => {
    const { input } = await setup();
    const draft = await localData.saveInvoiceDraft({ ...input, date: '2026-04-01', dueDate: '2026-04-15' });
    const copy = await localData.duplicateInvoiceDraft(draft._id, 1);
    expect(copy._id).not.toBe(draft._id);
    expect(copy).toMatchObject({ revision: 1, date: today(), dueDate: '', title: input.title + ' (copy)' });
    await localData.removeInvoiceDraft(copy._id, 1);
    expect(await localData.getInvoiceDrafts()).toHaveLength(1);
    await expect(localData.saveInvoiceDraft({ ...input, lineItems: Array.from({length: 101}, () => input.lineItems[0]) })).rejects.toThrow('100 line items');
    await expect(localData.saveInvoiceDraft({ ...input, lineItems: [{ ...input.lineItems[0], quantity: -1 }] })).rejects.toThrow('quantities');
});

test('round-trips drafts through encrypted backup and preserves older accounts with no draft collection', async () => {
    const account = { username: 'Retail owner', email: 'drafts@example.test', password: 'StrongLocal#123', businessName: 'Retail shop', address: 'Mumbai' };
    await localData.register(account); await localData.login(account);
    expect(await localData.getInvoiceDrafts()).toEqual([]);
    const draft = await localData.saveInvoiceDraft({ title: 'Sensitive purchase enquiry', lineItems: [] });
    const backup = await localData.exportBackup();
    expect(backup).not.toContain(draft.title);
    expect(await localData.previewBackup(backup, account.password)).toMatchObject({ drafts: 1, invoices: 0 });
    const duplicateBackup = await rewriteBackup(backup, account.password, workspace => workspace.invoiceDrafts.push({ ...workspace.invoiceDrafts[0] }));
    await expect(localData.previewBackup(duplicateBackup, account.password)).rejects.toThrow('duplicate drafts');
    localData.clearSession(); localStorage.clear();
    await localData.restoreBackup(backup, account.password); await localData.login(account);
    expect((await localData.getInvoiceDrafts())[0]).toMatchObject({ _id: draft._id, title: draft.title, revision: 1 });
    expect(await localData.getBills()).toEqual([]);
    const legacyBackup = await rewriteBackup(backup, account.password, workspace => { Reflect.deleteProperty(workspace, "invoiceDrafts"); });
    localData.clearSession(); localStorage.clear();
    await localData.restoreBackup(legacyBackup, account.password); await localData.login(account);
    expect(await localData.getInvoiceDrafts()).toEqual([]);
});

test('failed storage writes retain the saved draft and leave numbering untouched', async () => {
    const { input } = await setup();
    const draft = await localData.saveInvoiceDraft(input);
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    try { await expect(localData.addBill({ ...input, draftId: draft._id, draftRevision: 1 })).rejects.toThrow('Storage full'); }
    finally { storage.mockRestore(); }
    expect(await localData.getInvoiceDrafts()).toHaveLength(1);
    const issued = await localData.addBill({ ...input, draftId: draft._id, draftRevision: 1 });
    expect(issued.invoiceNumber).toBe('BF/2627/000001');
});

export {};
