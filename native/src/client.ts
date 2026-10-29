import type { WorkspaceResponse } from './types';
export type Row = Record<string, unknown>;
interface AuthResponse { status?: number; data?: {flows?: unknown[]}; meta?: {session_token?: string} }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export type Vault = { get(): Promise<string | null>; set(token: string): Promise<void>; clear(): Promise<void> };

export function validateOrigin(value: string, development = false): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Configure the BillFlow service address.'); }
    const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) ||
        url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
        throw new Error('Use an HTTPS service origin without a path or credentials.');
    }
    return url.origin;
}

export class Client {
    onSessionExpired?: () => void;
    readonly origin: string;
    private token: string | null = null;
    private generation = 0;
    private uncertain = new Map<string, string>();
    private pending = new Map<string, Promise<unknown>>();
    private authBusy = false;
    constructor(origin: string, private vault: Vault, private uuid: () => string,
        private fetcher: typeof fetch = fetch, development = false) {
        this.origin = validateOrigin(origin, development);
    }
    async restore() { this.token = await this.vault.get(); }
    async request<T = unknown>(path: string, method = 'GET', values?: unknown, key?: string, allowPending = false): Promise<T> {
        const generation = this.generation;
        const response = await this.fetcher(this.origin + path, {
            method, headers: { 'Content-Type': 'application/json',
                ...(this.token ? { 'X-Session-Token': this.token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
            ...(values === undefined ? {} : { body: JSON.stringify(values) }),
        });
        const body: unknown = await response.json();
        const envelope = record(body) ? body : {};
        const data = record(envelope.data) ? envelope.data : {};
        const meta = record(envelope.meta) ? envelope.meta : {};
        if (generation !== this.generation) throw new Error('The account changed. Reopen this screen.');
        if (response.status === 401 && !allowPending) {
            this.token = null; this.generation += 1; this.uncertain.clear(); this.pending.clear();
            this.onSessionExpired?.();
            await this.vault.clear();
            throw new Error('Your session expired. Sign in again.');
        }
        if (!response.ok && !(allowPending && response.status === 401 && data.flows)) {
            const detail = typeof envelope.detail === 'string' ? envelope.detail : '';
            const errors = Array.isArray(envelope.errors) ? envelope.errors.filter(record).map(error => typeof error.message === 'string' ? error.message : '').filter(Boolean).join(' ') : '';
            throw new Error(detail || errors || 'The request could not be completed.');
        }
        if (path.startsWith('/_allauth/app/') && typeof meta.session_token === 'string' && meta.session_token) {
            await this.vault.set(meta.session_token);
            if (generation !== this.generation) throw new Error('Account changed. Sign in again.');
            this.token = meta.session_token;
        }
        return body as T;
    }
    async auth(action: string, values: Row) {
        if (this.authBusy) throw new Error('Wait for the current account request.');
        this.authBusy = true;
        try { return await this.request<AuthResponse>('/_allauth/app/v1/auth/' + action, 'POST', values, undefined, true); }
        finally { this.authBusy = false; }
    }
    async signOut() {
        await this.request('/_allauth/app/v1/auth/session', 'DELETE', undefined, undefined, true);
        this.generation += 1; this.token = null; this.uncertain.clear(); this.pending.clear();
        this.onSessionExpired?.();
        await this.vault.clear();
    }
    async workspace() {
        const result = await this.request<WorkspaceResponse>('/api/v1/workspace');
        if (result.format !== 'billflow-workspace' || result.version !== 1 || !result.workspace || !result.profile) {
            throw new Error('The service returned an unsupported workspace.');
        }
        return result;
    }
    command(action: string, args: unknown[]): Promise<unknown> {
        const fingerprint = JSON.stringify([action, args]);
        const existing = this.pending.get(fingerprint);
        if (existing) return existing;
        const key = this.uncertain.get(fingerprint) || this.uuid();
        this.uncertain.set(fingerprint, key);
        const operation = this.request('/api/v1/actions/' + action, 'POST', { args }, key)
            .then(result => { this.uncertain.delete(fingerprint); return result; })
            .finally(() => this.pending.delete(fingerprint));
        this.pending.set(fingerprint, operation);
        return operation;
    }
}
