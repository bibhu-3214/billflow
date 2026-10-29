import type { CloudClient, FetchTransport, ResponseLike, ApiEnvelope } from '../types/data';
import type { PublicConfig, UserProfile } from '../types/domain';
import { asAppError } from '../types/domain';
import { changeSession } from '../utils/sessionBoundary';
// Browser sessions live in HttpOnly server cookies. No auth tokens or passwords are cached.
export const isCloudMode = process.env.REACT_APP_ACCOUNT_BACKEND === 'django';

export function createCloudData(fetcher: FetchTransport = (path, options) => fetch(path, options)) {
    let user: UserProfile | null = null;
    let config: PublicConfig | null = null;
    let loadingConfig: Promise<PublicConfig> | null = null;
    let generation = 0;
    const uncertain = new Map<string, string>();
    const inFlight = new Map<string, Promise<unknown>>();
    const root = '/api/v1/';
    const authRoot = '/_allauth/browser/v1/';

    const signalKey = 'billflow:account-boundary:v1';
    let listening = false;
    let channel: BroadcastChannel | undefined;
    let checking: Promise<void> | null = null;
    const cancelled = () => Object.assign(new Error('The account changed. Reopen this screen.'), { cancelled: true });
    const assertGeneration = (epoch: number) => { if (epoch !== generation) throw cancelled(); };
    const mask = (value: boolean) => document.documentElement.toggleAttribute('data-session-checking', value);
    const invalidate = () => {
        generation += 1; changeSession(); user = null; config = null; loadingConfig = null;
        uncertain.clear(); inFlight.clear();
        window.dispatchEvent(new Event('billflow:session-expired'));
        checking = null; mask(false);
    };
    const broadcast = () => {
        channel?.postMessage('invalidate');
        try { localStorage.setItem(signalKey, `${Date.now()}:${Math.random()}`); } catch { /* BroadcastChannel remains available when storage is restricted. */ }
    };
    const revalidate = () => {
        if (!user || checking) return;
        const epoch = generation, identity = user._id;
        mask(true);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const task = (async () => {
            try {
                const response = await fetcher(root + 'me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
                const body = await response.json() as { user?: UserProfile };
                if (epoch === generation && (!response.ok || body.user?._id !== identity)) invalidate();
            } catch { if (epoch === generation) invalidate(); }
            finally { clearTimeout(timeout); }
        })();
        checking = task;
        task.finally(() => { if (checking === task) { checking = null; mask(false); } }).catch(() => {});
    };
    const listen = () => {
        if (listening) return;
        listening = true;
        const received = () => { invalidate(); mask(false); };
        window.addEventListener('storage', event => { if (event.key === signalKey) received(); });
        if (typeof window.BroadcastChannel === 'function') {
            channel = new window.BroadcastChannel(signalKey);
            channel.onmessage = received;
        }
        window.addEventListener('focus', revalidate);
        window.addEventListener('pageshow', revalidate);
        window.addEventListener('pagehide', () => { if (user) { changeSession(); mask(true); } });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') revalidate();
            else if (user) { changeSession(); mask(true); }
        });
    };
    const parse = async (response: ResponseLike): Promise<unknown> => {
        try { return await response.json(); }
        catch { throw new Error('The service returned an unreadable response. Reload and try again.'); }
    };
    const errorFor = (body: ApiEnvelope, response: ResponseLike) => {
        const error = Object.assign(new Error(body.detail || body.errors?.map(e => e.message).filter(Boolean).join(' ') ||
            (response.status === 401 ? 'Sign in with a verified email address to continue.' : 'The request could not be completed.')), { status: response.status });
        return error;
    };
    const publicConfig = async (): Promise<PublicConfig> => {
        if (config) return config;
        if (!loadingConfig) {
            const epoch = generation;
            const task = (async () => {
                const response = await fetcher(root + 'config', { credentials: 'same-origin', cache: 'no-store' });
                const body = await parse(response) as PublicConfig;
                assertGeneration(epoch);
                if (!response.ok) throw errorFor(body as ApiEnvelope, response);
                config = body;
                return config;
            })();
            loadingConfig = task;
            task.finally(() => { if (loadingConfig === task) loadingConfig = null; }).catch(() => {});
        }
        return loadingConfig;
    };
    const request = async <T = ApiEnvelope>(path: string, { method = 'GET', values, key, pending = false }: { method?: string; values?: unknown; key?: string; pending?: boolean } = {}): Promise<T> => {
        const epoch = generation;
        const cfg = await publicConfig();
        assertGeneration(epoch);
        const response = await fetcher(path, {
            method, credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': cfg.csrfToken } : {}),
                ...(key ? { 'Idempotency-Key': key } : {}) },
            ...(values === undefined ? {} : { body: JSON.stringify(values) }),
        });
        const body = await parse(response);
        const envelope = (body && typeof body === 'object' ? body : {}) as ApiEnvelope;
        if (epoch !== generation) {
            const error = Object.assign(new Error('The account changed. Reopen this screen.'), { cancelled: true });
            throw error;
        }
        // allauth rotates the CSRF secret at sign-in; always obtain the next token.
        if (path.startsWith(authRoot)) config = null;
        if ([401, 403].includes(response.status) && path.startsWith(root) && user) {
            invalidate();
        }
        if (!response.ok && !(pending && response.status === 401 && envelope.data?.flows)) throw errorFor(envelope, response);
        return body as T;
    };
    const refreshUser = async () => {
        const epoch = generation;
        const result = await request<{ user: UserProfile }>(root + 'me');
        assertGeneration(epoch);
        user = result.user;
        return { user };
    };
    const auth = (path: string, values: unknown, pending = false) => request(authRoot + path, { method: 'POST', values, pending });
    type BaseClient = Pick<CloudClient, 'isCloud' | 'publicConfig' | 'auth' | 'initialize' | 'hasActiveSession' | 'getCurrentUser' | 'register' | 'login' | 'clearSession' | 'openDemo' | 'exportWorkspace' | 'previewImport' | 'commitImport' | 'deleteAccount'>;
    const base: BaseClient = {
        isCloud: true, publicConfig, auth,
        async initialize() {
            listen();
            try { await refreshUser(); }
            catch (caughtError) { const error = asAppError(caughtError);  if (![401, 403].includes(error.status || 0)) throw error; user = null; }
        },
        hasActiveSession: () => Boolean(user),
        getCurrentUser: () => {
            if (!user) throw new Error('Sign in to open your business.');
            return user;
        },
        async register(values) {
            const result = await auth('auth/signup', values, true);
            if (result.data?.flows?.some(flow => flow.id === 'verify_email')) return { verificationRequired: true };
            if ((result.status || 0) >= 400) throw new Error('Verify your email before signing in.');
            return result;
        },
        async login(values) {
            listen();
            invalidate();
            const result = await auth('auth/login', values, true);
            if (result.status === 401) throw new Error('Verify your email with the link we sent, then sign in.');
            const resultUser = await refreshUser();
            broadcast();
            return resultUser;
        },
        async clearSession() {
            await request(authRoot + 'auth/session', { method: 'DELETE', pending: true });
            invalidate();
            broadcast();
        },
        async openDemo() { throw new Error('The sample workspace is available in the separate local build.'); },
        exportWorkspace: () => request<Awaited<ReturnType<CloudClient['exportWorkspace']>>>(root + 'workspace'),
        previewImport: payload => request<Awaited<ReturnType<CloudClient['previewImport']>>>(root + 'import/preview', { method: 'POST', values: payload }),
        commitImport: values => request(root + 'import/commit', { method: 'POST', values }),
        async deleteAccount(password) {
            await request(root + 'account/delete', { method: 'POST', values: { password, confirmation: 'DELETE' } });
            invalidate();
            broadcast();
        },
    };
    const cloud = base as CloudClient;
    const reads = ['getCustomers', 'getProducts', 'getBills', 'getBill', 'getSettings', 'getInvoiceDrafts', 'getQuotations', 'getInvoiceTemplates', 'getStockRecords', 'getFollowUps'];
    const writes = ['addCustomer', 'editCustomer', 'removeCustomer', 'addProduct', 'editProduct', 'removeProduct',
        'saveSettings', 'recordStockMovement', 'saveFollowUp', 'setFollowUpStatus', 'saveInvoiceDraft', 'duplicateInvoiceDraft',
        'removeInvoiceDraft', 'saveQuotation', 'setQuotationStatus', 'saveInvoiceTemplate', 'removeInvoiceTemplate',
        'draftFromTemplate', 'addBill', 'recordPayment', 'correctInvoice', 'removeBill'];
    for (const operation of [...reads, ...writes]) (cloud as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[operation] = (...args: unknown[]) => {
        if (['saveInvoiceDraft', 'saveFollowUp'].includes(operation)) args = [args[0], args[1] || null, args[2] ?? null];
        const values = { args };
        if (reads.includes(operation)) return request(root + 'actions/' + operation, { method: 'POST', values });
        // A lost response retains the same request identity for an explicit retry.
        // Successful separate actions always receive a fresh key.
        const epoch = generation;
        const fingerprint = JSON.stringify([operation, args]);
        const pendingRequest = inFlight.get(fingerprint);
        if (pendingRequest) return pendingRequest;
        let key = uncertain.get(fingerprint);
        if (!key) {
            const bytes = window.crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
            key = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
            uncertain.set(fingerprint, key);
        }
        const result = request(root + 'actions/' + operation, { method: 'POST', values, key })
            .then(value => { assertGeneration(epoch); uncertain.delete(fingerprint); return value; })
            .catch((problem: unknown) => { const error = asAppError(problem); if (epoch === generation && error.status && error.status < 500) uncertain.delete(fingerprint); throw error; })
            .finally(() => { if (inFlight.get(fingerprint) === result) inFlight.delete(fingerprint); });
        inFlight.set(fingerprint, result);
        return result;
    };
    return cloud;
}

export default createCloudData();
