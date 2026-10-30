import { historyFingerprint, planHistoricalSales, validateHistoricalSales } from '../utils/historicalSales';
import type { BrowserDataClient } from '../types/data';
import type { BrowserDatabase, BrowserSession, StoredUser, UserProfile, Workspace, EncryptedPayload, EncryptedBackup, BackupContents, ProductInput, CustomerInput, DraftInput, FollowUpInput, InvoiceTemplate, InvoiceLineInput, Quotation, FollowUp, StockRecord, StockMovement, BusinessSettings, Invoice } from '../types/domain';
import { changeSession } from '../utils/sessionBoundary';
import { createDemoWorkspace } from './demoWorkspace';
import { calculateInvoice, financialYear, validDate, validGSTIN, paymentSummary, today, paise, states } from '../utils/indiaBilling';

const DEMO_DATABASE_KEY = 'billflow:demo:v1';
const DATABASE_KEY = 'billflow:database:v1';
const SESSION_KEY = 'billflow:session:v2';
const AUTH_VERSION = 2;
const PASSWORD_ITERATIONS = 310000;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const requireWebCrypto = () => {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('This browser does not support secure local encryption.');
    }
};

const randomBytes = (length: number) => {
    requireWebCrypto();
    return window.crypto.getRandomValues(new Uint8Array(length));
};

const bytesToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
};
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

const createId = (prefix: string) => `${prefix}_${bytesToBase64(randomBytes(16)).replace(/[^a-z0-9]/gi, '')}`;
const emptyDatabase = (): BrowserDatabase => ({ users: [], workspaces: {} });

let sessionGeneration = 0;
const destinations = new WeakMap<BrowserDatabase, { storage: Storage; key: string; generation: number }>();
const assertGeneration = (generation: number) => {
    if (generation !== sessionGeneration) {
        const error = Object.assign(new Error('The account changed. Reopen this screen.'), { cancelled: true });
        throw error;
    }
};

const readDatabase = (): BrowserDatabase => {
    try {
        const demo = sessionStorage.getItem(DEMO_DATABASE_KEY);
        const storage = demo ? sessionStorage : localStorage;
        const key = demo ? DEMO_DATABASE_KEY : DATABASE_KEY;
        const stored = demo || storage.getItem(key);
        const parsed = stored ? JSON.parse(stored) as BrowserDatabase : emptyDatabase();
        const database = { users: Array.isArray(parsed.users) ? parsed.users : [], workspaces: parsed.workspaces || {} };
        destinations.set(database, { storage, key, generation: sessionGeneration });
        return database;
    } catch (error) {
        throw new Error('The local workspace is damaged and could not be opened.');
    }
};

const writeDatabase = (database: BrowserDatabase) => {
    const target = destinations.get(database);
    if (!target) throw new Error('The workspace storage destination is unavailable.');
    assertGeneration(target.generation);
    target.storage.setItem(target.key, JSON.stringify(database));
};

const deriveCredentials = async (password: string, salt: Uint8Array<ArrayBuffer>) => {
    requireWebCrypto();
    const material = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits'],
    );
    const bits = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
        material,
        512,
    );
    const bytes = new Uint8Array(bits);
    return { verifier: bytes.slice(0, 32), encryptionKey: bytes.slice(32, 64) };
};

const legacyPasswordHash = async (password: string) => {
    const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(password));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const safelyEqual = (left: Uint8Array, right: Uint8Array) => {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
};

const importEncryptionKey = (keyBytes: Uint8Array<ArrayBuffer>) =>
    window.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

const encryptWorkspace = async (workspace: unknown, keyBytes: Uint8Array<ArrayBuffer>): Promise<EncryptedPayload> => {
    const key = await importEncryptionKey(keyBytes);
    const iv = randomBytes(12);
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(JSON.stringify(workspace)),
    );
    return { version: 2, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
};

const decryptPayload = async (encryptedWorkspace: EncryptedPayload | undefined, keyBytes: Uint8Array<ArrayBuffer>): Promise<unknown> => {
    if (!encryptedWorkspace || encryptedWorkspace.version !== 2) {
        throw new Error('This workspace must be unlocked again.');
    }
    try {
        const key = await importEncryptionKey(keyBytes);
        const plaintext = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToBytes(encryptedWorkspace.iv) },
            key,
            base64ToBytes(encryptedWorkspace.ciphertext),
        );
        return JSON.parse(decoder.decode(plaintext));
    } catch (error) {
        throw new Error('The encrypted data could not be opened. Check your password and backup file.');
    }
};

const decryptWorkspace = async (encryptedWorkspace: EncryptedPayload | undefined, keyBytes: Uint8Array<ArrayBuffer>): Promise<Workspace> => {
    const workspace = await decryptPayload(encryptedWorkspace, keyBytes) as Partial<Workspace>;
    return {
        customers: Array.isArray(workspace.customers) ? workspace.customers : [],
        products: Array.isArray(workspace.products) ? workspace.products : [],
        bills: Array.isArray(workspace.bills) ? workspace.bills : [],
        invoiceDrafts: Array.isArray(workspace.invoiceDrafts) ? workspace.invoiceDrafts : [],
        quotations: Array.isArray(workspace.quotations) ? workspace.quotations : [],
        invoiceTemplates: Array.isArray(workspace.invoiceTemplates) ? workspace.invoiceTemplates : [],
        quotationSequence: workspace.quotationSequence || 0,
        stockRecords: Array.isArray(workspace.stockRecords) ? workspace.stockRecords : [],
        followUps: Array.isArray(workspace.followUps) ? workspace.followUps : [],
        historicalSales: validateHistoricalSales(workspace.historicalSales || [], workspace.customers || []),
        invoiceSequences: workspace.invoiceSequences || {},
        settings: workspace.settings || {},
    };
};

const clearSession = () => {
    sessionGeneration += 1;
    changeSession();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(DEMO_DATABASE_KEY);
    localStorage.removeItem('token');
};

const readSession = (): BrowserSession | null => {
    try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (!stored) return null;
        const session = JSON.parse(stored) as BrowserSession;
        if (!session || !session.userId || !session.workspaceKey || Date.now() >= session.expiresAt) {
            clearSession();
            return null;
        }
        return session;
    } catch (error) {
        clearSession();
        return null;
    }
};

const createSession = (userId: string, encryptionKey: Uint8Array<ArrayBuffer>) => {
    sessionGeneration += 1;
    changeSession();
    sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            userId,
            workspaceKey: bytesToBase64(encryptionKey),
            token: bytesToBase64(randomBytes(32)),
            expiresAt: Date.now() + SESSION_DURATION_MS,
        }),
    );
    localStorage.removeItem('token');
};

const publicUser = (user: StoredUser): UserProfile => {
    const {
        passwordHash,
        passwordSalt,
        passwordVerifier,
        failedAttempts,
        lockedUntil,
        authVersion,
        ...safeUser
    } = user;
    return safeUser;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const cleanText = (value: unknown, field: string, maximumLength = 120) => {
    const cleaned = String(value || '').trim();
    if (!cleaned || cleaned.length > maximumLength) throw new Error(`${field} is invalid.`);
    return cleaned;
};

const requireSession = async (database: BrowserDatabase) => {
    const generation = sessionGeneration;
    const session = readSession();
    if (!session) throw new Error('Your secure session has expired. Please sign in again.');
    const user = database.users.find(record => record._id === session.userId);
    if (!user) throw new Error('Your secure session is no longer valid.');
    const keyBytes = base64ToBytes(session.workspaceKey);
    const workspace = await decryptWorkspace(database.workspaces[user._id], keyBytes);
    assertGeneration(generation);
    if (readSession()?.token !== session.token) { clearSession(); assertGeneration(generation); }
    return { user, workspace, keyBytes };
};

let mutationQueue: Promise<unknown> = Promise.resolve();
const mutateWorkspace = async <T>(updater: (workspace: Workspace, user: StoredUser) => T): Promise<T> => {
    const database = readDatabase();
    const session = await requireSession(database);
    const result = updater(session.workspace, session.user);
    database.workspaces[session.user._id] = await encryptWorkspace(session.workspace, session.keyBytes);
    writeDatabase(database);
    return result;
};

const withWriteLock = async <T>(run: () => Promise<T>): Promise<T> => {
    return navigator.locks ? await navigator.locks.request('billflow-write', run) : await run();
};

const updateWorkspace = <T>(updater: (workspace: Workspace, user: StoredUser) => T): Promise<T> => {
    const generation = sessionGeneration;
    const run = () => { assertGeneration(generation); return mutateWorkspace(updater); };
    const operation = mutationQueue.then(() => withWriteLock(run));
    mutationQueue = operation.catch(() => {});
    return operation;
};

const productDefaults = (values: ProductInput) => {
    const hsn = String(values.hsn || '').trim();
    const gstRate = values.gstRate === '' || values.gstRate == null ? '' : Number(values.gstRate);
    if (hsn && !/^\d{4,8}$/.test(hsn)) throw new Error('HSN/SAC must contain 4–8 digits.');
    if (gstRate !== '' && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 40)) throw new Error('GST rate must be between 0 and 40.');
    return { hsn, gstRate, unit: cleanText(values.unit || 'NOS', 'Unit', 12), sku: optionalText(values.sku, 'SKU', 60), category: optionalText(values.category, 'Category', 80), description: optionalText(values.description, 'Description', 1000) };
};

const optionalText = (value: unknown, field: string, length: number) => value ? cleanText(value, field, length) : '';

// Drafts may be incomplete, but only known fields and bounded item values are stored.
const draftValues = (values: DraftInput, workspace: Workspace, allowMissing = false) => {
    const customer = String(values.customer || '');
    if (customer.length > 100) throw new Error('Draft customer is invalid.');
    if (customer && !allowMissing && !workspace.customers.some(record => record._id === customer)) throw new Error('The selected customer is unavailable. Choose another customer.');
    const dates = { date: '', dueDate: '' };
    for (const key of ['date', 'dueDate'] as const) {
        dates[key] = String(values[key] || '');
        if (dates[key] && !validDate(dates[key])) throw new Error('Choose valid draft dates.');
    }
    if (!Array.isArray(values.lineItems) || values.lineItems.length > 100) throw new Error('Drafts support up to 100 line items.');
    const lineItems = values.lineItems.map(item => {
        let product = workspace.products.find(record => record._id === item?.product);
        if (!product && allowMissing && typeof item?.product === 'string' && item.product.length <= 100) {
            product = { _id: item.product, name: cleanText(item.name, 'Draft item name'), price: Number(item.price) };
        }
        if (!product) throw new Error('A draft product is unavailable. Remove or replace it.');
        if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0 || Number(product.price) > 100000000) throw new Error('Draft item price is invalid.');
        const number = (key: 'quantity' | 'discount' | 'gstRate', min: number, max: number, integer = false) => {
            const value = item[key] == null ? '' : String(item[key]);
            const parsed = Number(value);
            if (value !== '' && (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed)))) throw new Error('Check draft quantities, discounts and GST rates.');
            return value;
        };
        return { product: product._id, name: product.name, price: product.price,
            quantity: number('quantity', 1, 10000, true), discount: number('discount', 0, 100), gstRate: number('gstRate', 0, 40),
            unit: optionalText(item.unit, 'Unit', 12), hsn: optionalText(item.hsn, 'HSN/SAC', 8) };
    });
    return { title: cleanText(values.title || 'Untitled invoice', 'Draft title', 80), customer, ...dates,
        gst: Boolean(values.gst), supplierGSTIN: optionalText(values.supplierGSTIN, 'Supplier GSTIN', 15),
        customerGSTIN: optionalText(values.customerGSTIN, 'Customer GSTIN', 15), supplierState: optionalText(values.supplierState, 'Supplier state', 2),
        placeOfSupply: optionalText(values.placeOfSupply, 'Place of supply', 2), billingAddress: optionalText(values.billingAddress, 'Billing address', 500),
        notes: optionalText(values.notes, 'Notes', 1000), lineItems };
};
const requireDraft = (workspace: Workspace, id: string, revision?: number | null) => {
    const draft = workspace.invoiceDrafts.find(record => record._id === id);
    if (!draft) throw new Error('This draft is no longer available. It may have been issued or deleted.');
    if (draft.revision !== revision) throw new Error('This draft changed in another editor. Close and reopen it before trying again.');
    return draft;
};
const requireQuotation = (workspace: Workspace, id: string, revision?: number | null) => {
    const record = workspace.quotations.find(quote => quote._id === id);
    if (!record) throw new Error('Quotation is no longer available.');
    if (record.revision !== revision) throw new Error('Quotation changed. Reload before trying again.');
    return record;
};
const followUpValues = (values: FollowUpInput, workspace: Workspace, allowMissing = false) => {
    const customer = String(values.customer || '');
    if (!customer || customer.length > 100 || (!allowMissing && !workspace.customers.some(record => record._id === customer))) throw new Error('Choose an available customer.');
    if (!validDate(values.dueDate)) throw new Error('Choose a valid follow-up date.');
    if (!['Phone', 'WhatsApp', 'Email', 'In person'].includes(values.channel || '') || !['Collection', 'Order enquiry', 'Account review'].includes(values.purpose || '') || !['Normal', 'High'].includes(values.priority || '')) throw new Error('Choose valid follow-up details.');
    return { customer, title: cleanText(values.title, 'Follow-up title', 80), dueDate: values.dueDate, channel: values.channel!, purpose: values.purpose!, priority: values.priority!, notes: optionalText(values.notes, 'Follow-up notes', 1000) };
};
const quotationValues = (values: DraftInput, workspace: Workspace, allowMissing = false) => {
    const record = draftValues(values, workspace, allowMissing);
    if (allowMissing) record.lineItems = record.lineItems.map((item, index) => ({ ...item, price: Number(values.lineItems[index].price), name: cleanText(values.lineItems[index].name, 'Quotation item name') }));
    if (!record.customer || !record.billingAddress || !record.date || !record.dueDate || record.dueDate < record.date) throw new Error('Choose a customer, address and valid quotation dates.');
    if (record.gst && (!validGSTIN(record.supplierGSTIN) || record.supplierGSTIN.slice(0, 2) !== record.supplierState || (record.customerGSTIN && !validGSTIN(record.customerGSTIN)))) throw new Error('Check quotation GSTIN details.');
    if (record.gst && record.lineItems.some(item => !/^\d{4,8}$/.test(item.hsn))) throw new Error('Enter a valid HSN/SAC for each quotation item.');
    calculateInvoice(record.lineItems, record);
    return record;
};
const templateValues = (values: DraftInput, workspace: Workspace, allowMissing = false) => {
    const record = draftValues({ title: values.title, lineItems: values.lineItems, notes: values.notes }, workspace, allowMissing);
    calculateInvoice(record.lineItems);
    return { title: record.title, lineItems: record.lineItems, notes: record.notes };
};
const customerDefaults = (values: CustomerInput) => {
    const gstin = String(values.gstin || '').trim().toUpperCase();
    const state = values.state || '';
    if (state && !states[state]) throw new Error('Select a valid state.');
    if (gstin && (!validGSTIN(gstin) || gstin.slice(0, 2) !== state)) throw new Error('GSTIN must be valid and match the selected state.');
    return { company: optionalText(values.company, 'Company', 120), contactPerson: optionalText(values.contactPerson, 'Contact person', 120),
        address: optionalText(values.address, 'Billing address', 500), notes: optionalText(values.notes, 'Notes', 1000), state, gstin };
};

const BACKUP_LIMIT = 20 * 1024 * 1024;
const openBackup = async (text: string, password: string) => {
    if (typeof text !== 'string' || text.length > BACKUP_LIMIT) throw new Error('Backup must be a BillFlow JSON file under 20 MB.');
    let backup: EncryptedBackup;
    try { backup = JSON.parse(text) as EncryptedBackup; } catch { throw new Error('Invalid backup JSON.'); }
    if (backup?.format !== 'billflow-encrypted-backup' || backup.version !== 1 || typeof backup.salt !== 'string' ||
        !/^[A-Za-z0-9+/]{22}==$/.test(backup.salt) || backup.payload?.version !== 2 ||
        typeof backup.payload.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(backup.payload.iv) ||
        typeof backup.payload.ciphertext !== 'string') throw new Error('Unsupported or damaged backup.');
    if (!password) throw new Error('Enter the password used when this backup was created.');
    const credentials = await deriveCredentials(password, base64ToBytes(backup.salt));
    const { profile, workspace: recoveredWorkspace, createdAt } = await decryptPayload(backup.payload, credentials.encryptionKey) as BackupContents;
    // Keep missing legacy fields visible to the validation below before filling defaults.
    const workspace = recoveredWorkspace as Workspace;
    validateHistoricalSales(workspace.historicalSales || [], workspace.customers || []);
    if (!profile || typeof profile._id !== 'string' || typeof profile.email !== 'string' || !profile.email.includes('@') ||
        !workspace || !(['customers', 'products', 'bills'] as const).every(key => Array.isArray(workspace[key])) ||
        typeof createdAt !== 'string') throw new Error('Backup contents are invalid.');
    for (const key of ['customers', 'products', 'bills'] as const) {
        const ids = new Set<string>();
        for (const record of workspace[key]) {
            if (!record || typeof record._id !== 'string' || ids.has(record._id)) throw new Error('Backup contains invalid or duplicate records.');
            ids.add(record._id);
        }
    }
    if (workspace.invoiceDrafts !== undefined) {
        if (!Array.isArray(workspace.invoiceDrafts) || workspace.invoiceDrafts.length > 200) throw new Error('Backup drafts are invalid.');
        const ids = new Set<string>();
        for (const draft of workspace.invoiceDrafts) {
            if (!draft || typeof draft._id !== 'string' || !draft._id || draft._id.length > 100 || ids.has(draft._id) || !Number.isSafeInteger(draft.revision) || draft.revision < 1) throw new Error('Backup contains invalid or duplicate drafts.');
            Object.assign(draft, draftValues(draft, workspace, true));
            ids.add(draft._id);
        }
    }
    for (const [key, validate] of [['quotations', quotationValues], ['invoiceTemplates', templateValues]] as const) {
        if (workspace[key] === undefined) continue;
        if (!Array.isArray(workspace[key]) || workspace[key].length > 200) throw new Error('Backup preparation records are invalid.');
        const ids = new Set<string>();
        const numbers = new Set<string>();
        for (const record of workspace[key]) {
            if (!record || typeof record._id !== 'string' || !record._id || record._id.length > 100 || ids.has(record._id) || !Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error('Backup preparation records are invalid or duplicated.');
            validate(record, workspace, true);
            if (key === 'quotations') {
                const quote = record as Quotation;
                if (!['open', 'accepted', 'rejected', 'converted'].includes(quote.status) || !/^QT\/\d{4}\/\d{6}$/.test(quote.number) || numbers.has(quote.number) || Number(quote.number.slice(-6)) > workspace.quotationSequence || !quote.supplierSnapshot || !quote.customerSnapshot || quote.customerSnapshot._id !== quote.customer || (quote.status === 'converted' && !workspace.bills.some(bill => bill._id === quote.invoiceId && bill.sourceQuotationId === quote._id))) throw new Error('Backup quotation history is invalid.');
                for (const snapshot of [quote.supplierSnapshot, quote.customerSnapshot]) { cleanText(snapshot.name, 'Quotation party name'); cleanText(snapshot.address, 'Quotation address', 500); }
                numbers.add(quote.number);
            }
            ids.add(record._id);
        }
    }
    if (workspace.quotations?.length && workspace.quotationSequence === undefined) throw new Error('Backup quotation sequence is missing.');
    if (workspace.quotationSequence !== undefined && (!Number.isSafeInteger(workspace.quotationSequence) || workspace.quotationSequence < (workspace.quotations || []).length || workspace.quotationSequence > 999999)) throw new Error('Backup quotation sequence is invalid.');
    if (workspace.followUps !== undefined) {
        if (!Array.isArray(workspace.followUps) || workspace.followUps.length > 500) throw new Error('Backup follow-ups are invalid.');
        const ids = new Set<string>();
        for (const record of workspace.followUps) {
            if (!record || typeof record._id !== 'string' || !record._id || record._id.length > 100 || ids.has(record._id) || !Number.isSafeInteger(record.revision) || record.revision < 1 || !['open', 'completed'].includes(record.status) || !Array.isArray(record.history) || record.history.length > 100 || record.history.length !== record.revision) throw new Error('Backup follow-up history is invalid.');
            Object.assign(record, followUpValues(record, workspace, true)); cleanText(record.customerName, 'Follow-up customer name');
            for (const event of record.history) { if (!['created', 'updated', 'completed', 'reopened'].includes(event.action) || !Number.isFinite(Date.parse(event.at))) throw new Error('Backup follow-up event is invalid.'); if (['completed', 'reopened'].includes(event.action)) cleanText(event.outcome, 'Outcome', 500); else if (!validDate(event.dueDate)) throw new Error('Backup follow-up schedule is invalid.'); }
            if ((record.history[record.history.length - 1].action === 'completed') !== (record.status === 'completed')) throw new Error('Backup follow-up status does not match its history.');
            ids.add(record._id);
        }
    }
    if (workspace.stockRecords !== undefined) {
        if (!Array.isArray(workspace.stockRecords) || workspace.stockRecords.length > 1000) throw new Error('Backup stock records are invalid.');
        const ids = new Set<string>();
        for (const record of workspace.stockRecords) {
            if (!record || typeof record.product !== 'string' || !workspace.products.some(product => product._id === record.product) || ids.has(record.product) || !Number.isSafeInteger(record.revision) || record.revision < 1 || !Array.isArray(record.movements) || !record.movements.length || record.movements.length !== record.revision || record.movements.length > 200 || !Number.isInteger(record.reorderLevel) || record.reorderLevel < 0 || record.reorderLevel > 1000000) throw new Error('Backup stock history is invalid.');
            cleanText(record.unit, 'Stock unit', 12); cleanText(record.name, 'Stock product name');
            let balance = 0;
            record.movements.forEach((movement, index) => {
                if (!Number.isInteger(movement.delta) || Math.abs(movement.delta) > 1000000 || !Number.isFinite(Date.parse(movement.at)) || !['opening', 'adjustment', 'threshold'].includes(movement.type) || (index === 0 ? movement.type !== 'opening' : movement.type === 'opening') || !Number.isInteger(movement.reorderLevel) || movement.reorderLevel < 0 || movement.reorderLevel > 1000000) throw new Error('Backup stock movement is invalid.');
                cleanText(movement.reason, 'Stock reason', 500); balance += movement.delta;
                if (balance < 0 || balance > 1000000 || movement.balance !== balance || (movement.type === 'threshold' && movement.delta !== 0)) throw new Error('Backup stock balance is invalid.');
            });
            if (record.onHand !== balance || record.reorderLevel !== record.movements[record.movements.length - 1].reorderLevel) throw new Error('Backup stock balance does not match its history.');
            ids.add(record.product);
        }
    }
    const user = { _id: profile._id, email: normalizeEmail(profile.email), username: cleanText(profile.username, 'Name', 80),
        businessName: cleanText(profile.businessName, 'Business name'), address: cleanText(profile.address, 'Address', 500),
        passwordSalt: backup.salt, passwordVerifier: bytesToBase64(credentials.verifier), authVersion: AUTH_VERSION,
        failedAttempts: 0, lockedUntil: 0, createdAt: profile.createdAt };
    return { user, workspace: { invoiceDrafts: [], quotations: [], invoiceTemplates: [], stockRecords: [], followUps: [], settings: {}, invoiceSequences: {}, quotationSequence: 0, ...recoveredWorkspace }, credentials, createdAt };
};

const localData: BrowserDataClient = {
    async exportBackup() {
        const { user, workspace, keyBytes } = await requireSession(readDatabase());
        if (user.isDemo) throw new Error('Sample workspaces cannot be backed up. Create a local account to use encrypted backups.');
        const payload = await encryptWorkspace({ profile: publicUser(user), workspace, createdAt: new Date().toISOString() }, keyBytes);
        return JSON.stringify({ format: 'billflow-encrypted-backup', version: 1, salt: user.passwordSalt, payload });
    },

    async previewBackup(text, password) {
        const { user, workspace, createdAt } = await openBackup(text, password);
        return { email: user.email, businessName: user.businessName, createdAt,
            customers: workspace.customers.length, products: workspace.products.length, invoices: workspace.bills.length, drafts: (workspace.invoiceDrafts || []).length,
            quotations: (workspace.quotations || []).length, templates: (workspace.invoiceTemplates || []).length,
            historicalSales: (workspace.historicalSales || []).length, followUps: (workspace.followUps || []).length, trackedProducts: (workspace.stockRecords || []).length };
    },

    async restoreBackup(text, password) {
        const generation = sessionGeneration;
        const recovered = await openBackup(text, password);
        const run = async () => {
            assertGeneration(generation);
            const database = readDatabase();
            if (database.users.some(user => user._id === recovered.user._id || user.email === recovered.user.email)) {
                throw new Error('This account already exists here. Restore in a separate browser profile; existing accounts are never overwritten.');
            }
            database.users.push(recovered.user);
            database.workspaces[recovered.user._id] = await encryptWorkspace(recovered.workspace, recovered.credentials.encryptionKey);
            writeDatabase(database);
            return recovered.user.email;
        };
        const operation = mutationQueue.then(() => withWriteLock(run));
        mutationQueue = operation.catch(() => {});
        return operation;
    },
    async getSettings() {
        const { workspace, user } = await requireSession(readDatabase());
        return { name: user.businessName, address: user.address, gstin: '', state: '', terms: '', dueDays: 0, bankDetails: '', logo: '', ...workspace.settings };
    },

    async saveSettings(values) {
        return updateWorkspace(workspace => {
            const gstin = String(values.gstin || '').trim().toUpperCase();
            if (gstin && (!validGSTIN(gstin) || gstin.slice(0, 2) !== values.state)) throw new Error('GSTIN must be valid and match the selected state.');
            if (values.state && !states[values.state]) throw new Error('Select a valid state.');
            const dueDays = Number(values.dueDays);
            if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) throw new Error('Payment term must be 0–365 days.');
            const logo = String(values.logo || '');
            if (logo && (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 180000)) throw new Error('Use a PNG or JPEG logo under 130 KB.');
            const settings: BusinessSettings = { name: cleanText(values.name, 'Business name'), address: cleanText(values.address, 'Address', 500), gstin,
                state: values.state || '', dueDays, terms: String(values.terms || '').slice(0, 1000), bankDetails: String(values.bankDetails || '').slice(0, 500), logo };
            workspace.settings = settings;
            return settings;
        });
    },
    hasActiveSession() {
        return Boolean(readSession());
    },

    clearSession,

    async openDemo() {
        if (readSession()) throw new Error('Sign out before opening the sample workspace.');
        const generation = sessionGeneration;
        const key = randomBytes(32);
        const user = {
            _id: 'demo_user', username: 'Alex', email: 'alex@example.com',
            businessName: 'Studio North — Sample', address: 'Fictional workspace · India', isDemo: true,
        };
        const workspace = await encryptWorkspace(createDemoWorkspace(), key);
        assertGeneration(generation);
        try {
            sessionStorage.setItem(DEMO_DATABASE_KEY, JSON.stringify({ users: [user], workspaces: { [user._id]: workspace } }));
            createSession(user._id, key);
        } catch (error) {
            clearSession();
            throw error;
        }
        return { user };
    },

    async register(values) {
        const database = readDatabase();
        const email = normalizeEmail(values.email || '');
        if (database.users.some(user => user.email === email)) {
            throw new Error('An account with this email already exists.');
        }

        const salt = randomBytes(16);
        const credentials = await deriveCredentials(values.password, salt);
        const user = {
            _id: createId('user'),
            username: cleanText(values.username, 'Name', 80),
            email,
            passwordSalt: bytesToBase64(salt),
            passwordVerifier: bytesToBase64(credentials.verifier),
            authVersion: AUTH_VERSION,
            businessName: cleanText(values.businessName, 'Business name', 120),
            address: cleanText(values.address, 'Address', 240),
            failedAttempts: 0,
            lockedUntil: 0,
            createdAt: new Date().toISOString(),
        };

        database.users.push(user);
        database.workspaces[user._id] = await encryptWorkspace(
            { customers: [], products: [], bills: [] },
            credentials.encryptionKey,
        );
        writeDatabase(database);
        return publicUser(user);
    },

    async login({ email, password }) {
        const database = readDatabase();
        const user = database.users.find(record => record.email === normalizeEmail(email));
        const fallbackSalt = new Uint8Array(16);
        const salt = user && user.passwordSalt ? base64ToBytes(user.passwordSalt) : fallbackSalt;
        let credentials = await deriveCredentials(password, salt);
        let passwordMatches = false;

        if (user && user.authVersion === AUTH_VERSION && user.passwordVerifier) {
            passwordMatches = safelyEqual(credentials.verifier, base64ToBytes(user.passwordVerifier));
        } else if (user && user.passwordHash) {
            passwordMatches = safelyEqual(
                encoder.encode(await legacyPasswordHash(password)),
                encoder.encode(user.passwordHash),
            );
        }

        if (!user || !passwordMatches || Number(user.lockedUntil || 0) > Date.now()) {
            if (user) {
                user.failedAttempts = Number(user.failedAttempts || 0) + 1;
                if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
                    user.lockedUntil = Date.now() + LOCK_DURATION_MS;
                    user.failedAttempts = 0;
                }
                writeDatabase(database);
            }
            throw new Error('The credentials are incorrect or sign-in is temporarily locked.');
        }

        if (user.authVersion !== AUTH_VERSION) {
            const upgradedSalt = randomBytes(16);
            credentials = await deriveCredentials(password, upgradedSalt);
            user.passwordSalt = bytesToBase64(upgradedSalt);
            user.passwordVerifier = bytesToBase64(credentials.verifier);
            user.authVersion = AUTH_VERSION;
            delete user.passwordHash;
            database.workspaces[user._id] = await encryptWorkspace(
                database.workspaces[user._id] || { customers: [], products: [], bills: [] },
                credentials.encryptionKey,
            );
        }

        user.failedAttempts = 0;
        user.lockedUntil = 0;
        writeDatabase(database);
        createSession(user._id, credentials.encryptionKey);
        return { user: publicUser(user) };
    },

    getCurrentUser() {
        const session = readSession();
        if (!session) throw new Error('Your secure session has expired.');
        const user = readDatabase().users.find(record => record._id === session.userId);
        if (!user) throw new Error('Your secure session is no longer valid.');
        return publicUser(user);
    },

    async getHistoricalSales() { return (await requireSession(readDatabase())).workspace.historicalSales || []; },
    async previewHistoricalSales(payload, links) {
        const { workspace, user } = await requireSession(readDatabase());
        return { ...planHistoricalSales(payload, workspace.historicalSales || [], workspace.customers, links), revision: 0, digest: historyFingerprint(workspace, user._id, payload, links) };
    },
    async commitHistoricalSales(payload, links, preview, confirmation) {
        return updateWorkspace((workspace, user) => {
            if (confirmation !== 'IMPORT') throw new Error('Type IMPORT to confirm this import.');
            if (preview.digest !== historyFingerprint(workspace, user._id, payload, links)) throw new Error('The workspace or import changed. Review it again.');
            const proposed = planHistoricalSales(payload, workspace.historicalSales || [], workspace.customers, links);
            workspace.historicalSales = [...(workspace.historicalSales || []), ...proposed.records];
            return { imported: proposed.records.length, duplicates: proposed.duplicates };
        });
    },
    async getCustomers() {
        return [...(await requireSession(readDatabase())).workspace.customers];
    },

    async addCustomer(values) {
        return updateWorkspace(workspace => {
            const customer = {
                _id: createId('customer'),
                name: cleanText(values.name, 'Customer name', 100),
                email: normalizeEmail(values.email || ''),
                mobile: cleanText(values.mobile, 'Phone number', 20),
                ...customerDefaults(values),
            };
            workspace.customers.push(customer);
            return customer;
        });
    },

    async editCustomer(id, values) {
        return updateWorkspace(workspace => {
            const index = workspace.customers.findIndex(customer => customer._id === id);
            if (index < 0) throw new Error('Customer not found.');
            workspace.customers[index] = {
                ...workspace.customers[index],
                _id: id,
                name: cleanText(values.name, 'Customer name', 100),
                email: normalizeEmail(values.email || ''),
                mobile: cleanText(values.mobile, 'Phone number', 20),
                ...customerDefaults({ ...workspace.customers[index], ...values }),
            };
            return workspace.customers[index];
        });
    },

    async removeCustomer(id) {
        return updateWorkspace(workspace => {
            if ((workspace.historicalSales || []).some(row => row.customerId === id)) throw new Error('This customer is referenced by imported historical purchases.');
            if (workspace.bills.some(bill => bill.customer === id)) {
                throw new Error('This customer is used by an invoice and cannot be deleted.');
            }
            const customer = workspace.customers.find(record => record._id === id);
            if (!customer) throw new Error('Customer not found.');
            workspace.customers = workspace.customers.filter(record => record._id !== id);
            return customer;
        });
    },

    async getProducts() {
        return [...(await requireSession(readDatabase())).workspace.products];
    },

    async addProduct(values) {
        return updateWorkspace(workspace => {
            const price = Number(values.price);
            if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number.');
            const product = { _id: createId('product'), name: cleanText(values.name, 'Product name'), price, ...productDefaults(values) };
            workspace.products.push(product);
            return product;
        });
    },

    async editProduct(id, values) {
        return updateWorkspace(workspace => {
            const index = workspace.products.findIndex(product => product._id === id);
            if (index < 0) throw new Error('Product not found.');
            const price = Number(values.price);
            if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number.');
            workspace.products[index] = { ...workspace.products[index], name: cleanText(values.name, 'Product name'), price, ...productDefaults({ ...workspace.products[index], ...values }) };
            return workspace.products[index];
        });
    },

    async removeProduct(id) {
        return updateWorkspace(workspace => {
            if (workspace.stockRecords.some(record => record.product === id)) throw new Error('This product has stock history and cannot be deleted.');
            if (workspace.bills.some(bill => bill.lineItems.some(item => item.product === id))) {
                throw new Error('This product is used by an invoice and cannot be deleted.');
            }
            const product = workspace.products.find(record => record._id === id);
            if (!product) throw new Error('Product not found.');
            workspace.products = workspace.products.filter(record => record._id !== id);
            return product;
        });
    },

    async getStockRecords() {
        return (await requireSession(readDatabase())).workspace.stockRecords;
    },
    async recordStockMovement(values) {
        return updateWorkspace(workspace => {
            const product = workspace.products.find(record => record._id === values.product);
            if (!product) throw new Error('Product is unavailable.');
            const record = workspace.stockRecords.find(stock => stock.product === product._id);
            if ((record?.revision || 0) !== values.revision) throw new Error('Stock changed in another editor. Close and reopen to refresh.');
            if (record && record.unit !== (product.unit || 'NOS')) throw new Error('Catalog unit differs from the tracked stock unit. Restore the original unit before adjusting; units are not converted automatically.');
            if ((record?.movements.length || 0) >= 200 || (!record && workspace.stockRecords.length >= 1000)) throw new Error('Stock history limit reached. Export a backup; no history was removed.');
            const type = values.type;
            const delta = Number(values.delta), reorderLevel = Number(values.reorderLevel);
            if ((record ? !['adjustment', 'threshold'].includes(type || '') : type !== 'opening') || values.delta == null || String(values.delta).trim() === '' || !Number.isInteger(delta) || Math.abs(delta) > 1000000 || (type === 'opening' && delta < 0) || (type === 'adjustment' && delta === 0) || (type === 'threshold' && delta !== 0)) throw new Error('Enter a valid whole-unit stock movement.');
            if (values.reorderLevel == null || String(values.reorderLevel).trim() === '' || !Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 1000000) throw new Error('Enter a valid reorder level.');
            const balance = (record?.onHand || 0) + delta;
            if (balance < 0 || balance > 1000000) throw new Error('Stock cannot be negative or exceed 1,000,000 units.');
            const reason = cleanText(values.reason, 'Adjustment reason', 500);
            const movement: StockMovement = { type: type as StockMovement['type'], delta, balance, reorderLevel, reason, at: new Date().toISOString() };
            const updated: StockRecord = { product: product._id, name: product.name, unit: product.unit || 'NOS', onHand: balance, reorderLevel,
                revision: (record?.revision || 0) + 1, movements: [...(record?.movements || []), movement] };
            workspace.stockRecords = record ? workspace.stockRecords.map(stock => stock.product === product._id ? updated : stock) : [...workspace.stockRecords, updated];
            return updated;
        });
    },
    async getFollowUps() {
        return (await requireSession(readDatabase())).workspace.followUps;
    },
    async saveFollowUp(values, id, revision) {
        return updateWorkspace(workspace => {
            const record = id ? workspace.followUps.find(item => item._id === id) : null;
            if (id && (!record || record.revision !== revision)) throw new Error('Follow-up changed or is unavailable. Close and reopen to refresh.');
            if (record?.status === 'completed') throw new Error('Reopen this follow-up before editing.');
            if ((record?.history.length || 0) >= 100 || (!record && workspace.followUps.length >= 500)) throw new Error('Follow-up history limit reached. Export a backup; no history was removed.');
            const fields = followUpValues(values, workspace);
            const now = new Date().toISOString();
            const updated: FollowUp = { ...fields, _id: record?._id || createId('followup'), customerName: workspace.customers.find(customer => customer._id === fields.customer)!.name,
                status: 'open', revision: (record?.revision || 0) + 1, createdAt: record?.createdAt || now, updatedAt: now,
                history: [...(record?.history || []), { action: record ? 'updated' : 'created', at: now, dueDate: fields.dueDate }] };
            workspace.followUps = record ? workspace.followUps.map(item => item._id === id ? updated : item) : [...workspace.followUps, updated];
            return updated;
        });
    },
    async setFollowUpStatus(id, revision, status, outcome) {
        return updateWorkspace(workspace => {
            const record = workspace.followUps.find(item => item._id === id);
            if (!record || record.revision !== revision) throw new Error('Follow-up changed or is unavailable. Close and reopen to refresh.');
            if (!['open', 'completed'].includes(status) || record.status === status) throw new Error('Choose a different follow-up status.');
            if (record.history.length >= 100) throw new Error('Follow-up history limit reached.');
            const note = cleanText(outcome, 'Outcome / reason', 500);
            record.status = status as FollowUp['status']; record.revision += 1; record.updatedAt = new Date().toISOString();
            record.history.push({ action: status === 'completed' ? 'completed' : 'reopened', at: record.updatedAt, outcome: note });
            return record;
        });
    },
    async getInvoiceDrafts() {
        const { workspace } = await requireSession(readDatabase());
        return workspace.invoiceDrafts.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    },

    async saveInvoiceDraft(values, id, revision) {
        return updateWorkspace(workspace => {
            const current = id ? requireDraft(workspace, id, revision) : null;
            if ((current?.revision || 0) >= Number.MAX_SAFE_INTEGER) throw new Error('Draft revision limit reached. Duplicate the draft to continue.');
            if (!current && workspace.invoiceDrafts.length >= 200) throw new Error('The workspace supports 200 drafts. Issue or remove an older draft first.');
            const now = new Date().toISOString();
            const draft = { ...draftValues(values, workspace), _id: current?._id || createId('draft'),
                revision: (current?.revision || 0) + 1, createdAt: current?.createdAt || now, updatedAt: now };
            workspace.invoiceDrafts = current ? workspace.invoiceDrafts.map(record => record._id === id ? draft : record) : [...workspace.invoiceDrafts, draft];
            return draft;
        });
    },

    async duplicateInvoiceDraft(id, revision) {
        return updateWorkspace(workspace => {
            const source = requireDraft(workspace, id, revision);
            if (workspace.invoiceDrafts.length >= 200) throw new Error('The workspace supports 200 drafts. Issue or remove an older draft first.');
            const now = new Date().toISOString();
            const draft = { ...draftValues({ ...source, title: (source.title + ' (copy)').slice(0, 80), date: today(), dueDate: '' }, workspace, true),
                _id: createId('draft'), revision: 1, createdAt: now, updatedAt: now };
            workspace.invoiceDrafts.push(draft);
            return draft;
        });
    },

    async removeInvoiceDraft(id, revision) {
        return updateWorkspace(workspace => {
            const draft = requireDraft(workspace, id, revision);
            workspace.invoiceDrafts = workspace.invoiceDrafts.filter(record => record._id !== id);
            return draft;
        });
    },

    async getBills() {
        return [...(await requireSession(readDatabase())).workspace.bills];
    },

    async getBill(id) {
        const bill = (await requireSession(readDatabase())).workspace.bills.find(record => record._id === id);
        if (!bill) throw new Error('Invoice not found.');
        return bill;
    },

    async getQuotations() {
        const { workspace } = await requireSession(readDatabase());
        return workspace.quotations.slice().reverse();
    },
    async saveQuotation(values) {
        return updateWorkspace((workspace, user) => {
            if (workspace.quotations.length >= 200) throw new Error('The workspace supports 200 quotations.');
            const record = quotationValues(values, workspace);
            const sequence = workspace.quotationSequence + 1;
            if (sequence > 999999) throw new Error('Quotation series is exhausted.');
            workspace.quotationSequence = sequence;
            const quote: Quotation = { ...record, _id: createId('quote'), number: `QT/${financialYear(record.date)}/${String(sequence).padStart(6, '0')}`, status: 'open', revision: 1,
                supplierSnapshot: { name: user.businessName, address: user.address, ...workspace.settings, gstin: record.supplierGSTIN },
                customerSnapshot: { ...workspace.customers.find(customer => customer._id === record.customer), address: record.billingAddress, gstin: record.customerGSTIN }, createdAt: new Date().toISOString() };
            workspace.quotations.push(quote);
            return quote;
        });
    },
    async setQuotationStatus(id, revision, status) {
        return updateWorkspace(workspace => {
            const quote = requireQuotation(workspace, id, revision);
            if (!['accepted', 'rejected'].includes(status) || quote.status !== 'open') throw new Error('Only open quotations can be accepted or rejected.');
            if (quote.dueDate < today()) throw new Error('This quotation expired. Create a new quotation.');
            quote.status = status as Quotation['status']; quote.revision += 1; quote.decidedAt = new Date().toISOString();
            return quote;
        });
    },
    async getInvoiceTemplates() {
        const { workspace } = await requireSession(readDatabase());
        return workspace.invoiceTemplates.slice().reverse();
    },
    async saveInvoiceTemplate(values) {
        return updateWorkspace(workspace => {
            if (workspace.invoiceTemplates.length >= 200) throw new Error('The workspace supports 200 templates.');
            const record = { ...templateValues(values, workspace), _id: createId('template'), revision: 1 };
            workspace.invoiceTemplates.push(record); return record;
        });
    },
    async removeInvoiceTemplate(id) {
        return updateWorkspace(workspace => {
            if (!workspace.invoiceTemplates.some(record => record._id === id)) throw new Error('Template is no longer available.');
            workspace.invoiceTemplates = workspace.invoiceTemplates.filter(record => record._id !== id);
        });
    },
    async draftFromTemplate(id) {
        return updateWorkspace(workspace => {
            const template = workspace.invoiceTemplates.find(record => record._id === id);
            if (!template) throw new Error('Template is no longer available.');
            if (workspace.invoiceDrafts.length >= 200) throw new Error('The workspace supports 200 drafts.');
            const settings = workspace.settings;
            const draft = { ...draftValues({ ...template, date: today(), dueDate: '', gst: Boolean(settings.gstin), supplierGSTIN: settings.gstin, supplierState: settings.state }, workspace),
                _id: createId('draft'), revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            workspace.invoiceDrafts.push(draft); return draft;
        });
    },
    async addBill(values) {
        return updateWorkspace((workspace, user) => {
            let quotation: Quotation | undefined;
            if (values.quotationId) {
                const issued = workspace.bills.find(bill => bill.sourceQuotationId === values.quotationId);
                if (issued) return issued;
                quotation = requireQuotation(workspace, values.quotationId, values.quotationRevision);
                quotationValues(quotation, workspace, true);
                if (quotation.status !== 'accepted' || quotation.dueDate < today()) throw new Error('Only accepted, unexpired quotations can be converted.');
                const date = values.date;
                if (!validDate(date) || date < quotation.date || date > quotation.dueDate) throw new Error('Invoice date must be within quotation validity.');
                values = { ...quotation, date, dueDate: values.dueDate, quotationId: quotation._id };
            }
            if (values.draftId) {
                const issued = workspace.bills.find(bill => bill.sourceDraftId === values.draftId);
                if (issued) return issued; // A retry must not allocate a second number.
                requireDraft(workspace, values.draftId, values.draftRevision);
            }
            const date = values.date?.slice(0, 10);
            if (!validDate(date)) throw new Error('Enter a valid invoice date.');
            const fy = financialYear(date);
            if (values.dueDate && (!validDate(values.dueDate) || values.dueDate < date)) throw new Error('Due date must be on or after the invoice date.');
            const gst = Boolean(values.gst);
            const supplierGSTIN = String(values.supplierGSTIN || '').trim().toUpperCase();
            const customerGSTIN = String(values.customerGSTIN || '').trim().toUpperCase();
            if (gst && (!validGSTIN(supplierGSTIN) || supplierGSTIN.slice(0, 2) !== values.supplierState)) throw new Error('Enter a valid supplier GSTIN matching the supplier state.');
            if (gst && customerGSTIN && !validGSTIN(customerGSTIN)) throw new Error('Customer GSTIN is invalid.');
            const billingAddress = cleanText(values.billingAddress, 'Billing address', 500);
            if (!workspace.customers.some(customer => customer._id === values.customer)) {
                throw new Error('The selected customer is unavailable.');
            }
            const lineItems = (values.lineItems || []).map(item => {
                const product = workspace.products.find(record => record._id === item.product);
                const quantity = Number(item.quantity);
                if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
                    throw new Error('One of the invoice items is invalid.');
                }
                const price = Number(quotation ? item.price : product.price);
                if (!quotation && item.price != null && Number(item.price) !== price) throw new Error('A catalog price changed. Save your work as a draft, then refresh the page and resume it to review current prices before issuing.');
                if (gst && !/^\d{4,8}$/.test(item.hsn || '')) throw new Error('Enter a 4–8 digit HSN/SAC for each item.');
                return {
                    _id: createId('item'),
                    product: product._id,
                    name: quotation ? item.name : product.name,
                    hsn: String(item.hsn || '').slice(0, 8),
                    unit: cleanText(item.unit || 'NOS', 'Unit', 12),
                    discount: item.discount || 0,
                    gstRate: item.gstRate,
                    quantity,
                    price,
                    subTotal: price * quantity,
                };
            });
            if (!lineItems.length) throw new Error('Add at least one invoice item.');
            const totals = calculateInvoice(lineItems, values);
            workspace.invoiceSequences = workspace.invoiceSequences || {};
            const sequence = Number(workspace.invoiceSequences[fy] || 0) + 1;
            if (sequence > 999999) throw new Error('Invoice series is exhausted.');
            workspace.invoiceSequences[fy] = sequence;
            const bill: Invoice = {
                ...totals,
                _id: createId('invoice'),
                invoiceNumber: `BF/${fy}/${String(sequence).padStart(6, '0')}`,
                date,
                dueDate: values.dueDate || date,
                gst,
                supplierState: values.supplierState || '',
                placeOfSupply: values.placeOfSupply || '',
                supplierSnapshot: quotation ? quotation.supplierSnapshot : { name: user.businessName, address: user.address, ...workspace.settings, gstin: gst ? supplierGSTIN : '' },
                customerSnapshot: quotation ? quotation.customerSnapshot : { ...workspace.customers.find(record => record._id === values.customer), address: billingAddress, gstin: gst ? customerGSTIN : '' },
                notes: String(values.notes || '').trim().slice(0, 1000),
                payments: [],
                customer: values.customer!,
                createdAt: new Date().toISOString(),
                ...(values.draftId ? { sourceDraftId: values.draftId } : {}),
                ...(quotation ? { sourceQuotationId: quotation._id, sourceQuotationNumber: quotation.number } : {}),
            };
            workspace.bills.push(bill);
            if (quotation) { quotation.status = 'converted'; quotation.invoiceId = bill._id; quotation.revision += 1; }
            if (values.draftId) workspace.invoiceDrafts = workspace.invoiceDrafts.filter(record => record._id !== values.draftId);
            return bill;
        });
    },

    async recordPayment(id, values) {
        return updateWorkspace(workspace => {
            const bill = workspace.bills.find(record => record._id === id);
            if (!bill) throw new Error('Invoice not found.');
            if (bill.cancellation || bill.creditNote) throw new Error('This invoice is closed.');
            const amount = Number(values.amount);
            if (!Number.isFinite(amount) || paise(amount) <= 0 || paise(amount) > paise(paymentSummary(bill).balance)) throw new Error('Payment must be positive and cannot exceed the balance.');
            if (!validDate(values.date) || values.date < bill.date.slice(0, 10) || values.date > today()) throw new Error('Payment date must be between invoice date and today.');
            if (!['UPI', 'Bank transfer', 'Cash', 'Card', 'Cheque'].includes(values.method)) throw new Error('Choose a payment method.');
            bill.payments = [...(bill.payments || []), { _id: createId('payment'), amount: paise(amount) / 100, date: values.date,
                method: values.method, reference: String(values.reference || '').trim().slice(0, 120), createdAt: new Date().toISOString() }];
            return bill;
        });
    },

    async correctInvoice(id, values) {
        return updateWorkspace((workspace, user) => {
            const bill = workspace.bills.find(record => record._id === id);
            if (!bill) throw new Error('Invoice not found.');
            const reason = cleanText(values.reason, 'Correction reason', 500);
            const event = { _id: createId('event'), reason, date: today(), createdAt: new Date().toISOString(), actor: user.username };
            if (values.action === 'reverse') {
                const payment = (bill.payments || []).find(p => p._id === values.paymentId);
                if (!payment || (bill.reversals || []).some(r => r.paymentId === payment._id)) throw new Error('Payment is missing or already reversed.');
                bill.reversals = [...(bill.reversals || []), { ...event, paymentId: payment._id, amount: payment.amount }];
            } else {
                if (bill.cancellation || bill.creditNote) throw new Error('This invoice is already closed.');
                if (paymentSummary(bill).paid > 0) throw new Error('Active payments remain. A refund must be handled outside BillFlow before reversing the payment record and closing the invoice.');
                if (bill.date.slice(0, 10) > today()) throw new Error('Cannot correct a future-dated invoice.');
                if (values.action === 'cancel') bill.cancellation = event;
                else if (values.action === 'credit') {
                    if (!bill.invoiceNumber) throw new Error('Credit notes require a numbered invoice.');
                    const fy = financialYear(today());
                    const key = 'CN' + fy;
                    const sequence = Number(workspace.invoiceSequences[key] || 0) + 1;
                    if (sequence > 999999) throw new Error('Credit note series exhausted.');
                    workspace.invoiceSequences[key] = sequence;
                    bill.creditNote = { ...event, number: `CN/${fy}/${String(sequence).padStart(6, '0')}`, amount: bill.total,
                        taxable: bill.taxable, cgst: bill.cgst, stateTax: bill.stateTax, igst: bill.igst };
                } else throw new Error('Invalid correction action.');
            }
            return bill;
        });
    },

    async removeBill(id) {
        return updateWorkspace(workspace => {
            const bill = workspace.bills.find(record => record._id === id);
            if (!bill) throw new Error('Invoice not found.');
            if (bill.invoiceNumber || bill.payments?.length || bill.cancellation || bill.creditNote || bill.reversals?.length) throw new Error('Issued invoices and payment records cannot be deleted.');
            workspace.bills = workspace.bills.filter(record => record._id !== id);
            return bill;
        });
    },
};

// Decryption stays on the device. Migration sends only the reviewed workspace, never
// the password, verifier, salt, browser session or encryption key.
export async function migrationPayload(text: string, password: string) {
    const { workspace, user, createdAt } = await openBackup(text, password);
    return { format: 'billflow-workspace' as const, version: 1 as const, workspace,
        profile: publicUser(user), createdAt };
}

export async function encryptPortableBackup(workspace: Workspace, profile: UserProfile, password: string) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
        throw new Error('Choose a backup password of 12–128 characters.');
    }
    cleanText(profile.username, 'Your name', 80);
    cleanText(profile.businessName, 'Business name');
    cleanText(profile.address, 'Business address: complete Business settings before exporting', 500);
    const salt = randomBytes(16);
    const credentials = await deriveCredentials(password, salt);
    const payload = await encryptWorkspace({ profile: { ...profile, _id: profile._id }, workspace,
        createdAt: new Date().toISOString() }, credentials.encryptionKey);
    return JSON.stringify({ format: 'billflow-encrypted-backup', version: 1, salt: bytesToBase64(salt), payload });
}

// Recheck at the public async boundary, including reads and encrypted exports.
for (const [name, method] of Object.entries(localData as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)) {
    if (['login', 'openDemo', 'clearSession', 'hasActiveSession', 'getCurrentUser'].includes(name)) continue;
    (localData as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[name] = (...args: unknown[]) => {
        const generation = sessionGeneration;
        return Promise.resolve(method(...args)).then(result => { assertGeneration(generation); return result; });
    };
}

export default localData;
