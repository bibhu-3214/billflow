// Browser sessions live in HttpOnly server cookies. No auth tokens or passwords are cached.
export const isCloudMode = process.env.REACT_APP_ACCOUNT_BACKEND === 'django';

export function createCloudData(fetcher = (...args) => fetch(...args)) {
    let user = null;
    let config = null;
    let loadingConfig = null;
    let generation = 0;
    const uncertain = new Map();
    const inFlight = new Map();
    const root = '/api/v1/';
    const authRoot = '/_allauth/browser/v1/';
    const parse = async response => {
        try { return await response.json(); }
        catch { throw new Error('The service returned an unreadable response. Reload and try again.'); }
    };
    const errorFor = (body, response) => {
        const error = new Error(body.detail || body.errors?.map(e => e.message).filter(Boolean).join(' ') ||
            (response.status === 401 ? 'Sign in with a verified email address to continue.' : 'The request could not be completed.'));
        error.status = response.status;
        return error;
    };
    const publicConfig = async () => {
        if (config) return config;
        if (!loadingConfig) loadingConfig = (async () => {
            const response = await fetcher(root + 'config', { credentials: 'same-origin', cache: 'no-store' });
            const body = await parse(response);
            if (!response.ok) throw errorFor(body, response);
            config = body;
            return config;
        })().finally(() => { loadingConfig = null; });
        return loadingConfig;
    };
    const request = async (path, { method = 'GET', values, key, pending = false } = {}) => {
        const epoch = generation;
        const cfg = await publicConfig();
        const response = await fetcher(path, {
            method, credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': cfg.csrfToken } : {}),
                ...(key ? { 'Idempotency-Key': key } : {}) },
            ...(values === undefined ? {} : { body: JSON.stringify(values) }),
        });
        const body = await parse(response);
        if (epoch !== generation) {
            const error = new Error('The account changed. Reopen this screen.');
            error.cancelled = true;
            throw error;
        }
        // allauth rotates the CSRF secret at sign-in; always obtain the next token.
        if (path.startsWith(authRoot)) config = null;
        if (response.status === 401 && path.startsWith(root) && user) {
            user = null;
            generation += 1; uncertain.clear(); inFlight.clear();
            window.dispatchEvent(new Event('billflow:session-expired'));
        }
        if (!response.ok && !(pending && response.status === 401 && body.data?.flows)) throw errorFor(body, response);
        return body;
    };
    const refreshUser = async () => {
        const result = await request(root + 'me');
        user = result.user;
        return { user };
    };
    const auth = (path, values, pending = false) => request(authRoot + path, { method: 'POST', values, pending });
    const cloud = {
        isCloud: true, publicConfig, auth,
        async initialize() {
            try { await refreshUser(); }
            catch (error) { if (![401, 403].includes(error.status)) throw error; user = null; }
        },
        hasActiveSession: () => Boolean(user),
        getCurrentUser: () => {
            if (!user) throw new Error('Sign in to open your business.');
            return user;
        },
        async register(values) {
            const result = await auth('auth/signup', values, true);
            if (result.data?.flows?.some(flow => flow.id === 'verify_email')) return { verificationRequired: true };
            if (result.status >= 400) throw new Error('Verify your email before signing in.');
            return result;
        },
        async login(values) {
            generation += 1; user = null; uncertain.clear(); inFlight.clear();
            const result = await auth('auth/login', values, true);
            if (result.status === 401) throw new Error('Verify your email with the link we sent, then sign in.');
            return refreshUser();
        },
        async clearSession() {
            await request(authRoot + 'auth/session', { method: 'DELETE', pending: true });
            generation += 1;
            user = null; config = null; uncertain.clear(); inFlight.clear();
        },
        async openDemo() { throw new Error('The sample workspace is available in the separate local build.'); },
        exportWorkspace: () => request(root + 'workspace'),
        previewImport: payload => request(root + 'import/preview', { method: 'POST', values: payload }),
        commitImport: values => request(root + 'import/commit', { method: 'POST', values }),
        async deleteAccount(password) {
            await request(root + 'account/delete', { method: 'POST', values: { password, confirmation: 'DELETE' } });
            generation += 1; user = null; config = null; uncertain.clear(); inFlight.clear();
        },
    };
    const reads = ['getCustomers', 'getProducts', 'getBills', 'getBill', 'getSettings', 'getInvoiceDrafts', 'getQuotations', 'getInvoiceTemplates', 'getStockRecords', 'getFollowUps'];
    const writes = ['addCustomer', 'editCustomer', 'removeCustomer', 'addProduct', 'editProduct', 'removeProduct',
        'saveSettings', 'recordStockMovement', 'saveFollowUp', 'setFollowUpStatus', 'saveInvoiceDraft', 'duplicateInvoiceDraft',
        'removeInvoiceDraft', 'saveQuotation', 'setQuotationStatus', 'saveInvoiceTemplate', 'removeInvoiceTemplate',
        'draftFromTemplate', 'addBill', 'recordPayment', 'correctInvoice', 'removeBill'];
    for (const operation of [...reads, ...writes]) cloud[operation] = (...args) => {
        if (['saveInvoiceDraft', 'saveFollowUp'].includes(operation)) args = [args[0], args[1] || null, args[2] ?? null];
        const values = { args };
        if (reads.includes(operation)) return request(root + 'actions/' + operation, { method: 'POST', values });
        // A lost response retains the same request identity for an explicit retry.
        // Successful separate actions always receive a fresh key.
        const fingerprint = JSON.stringify([operation, args]);
        if (inFlight.has(fingerprint)) return inFlight.get(fingerprint);
        let key = uncertain.get(fingerprint);
        if (!key) {
            const bytes = window.crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
            key = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
            uncertain.set(fingerprint, key);
        }
        const result = request(root + 'actions/' + operation, { method: 'POST', values, key })
            .then(value => { uncertain.delete(fingerprint); return value; })
            .catch(error => { if (error.status && error.status < 500) uncertain.delete(fingerprint); throw error; })
            .finally(() => inFlight.delete(fingerprint));
        inFlight.set(fingerprint, result);
        return result;
    };
    return cloud;
}

export default createCloudData();
