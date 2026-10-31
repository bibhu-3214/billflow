import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Check, ChevronRight, FileInput, Search, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import localData from '../../data/localData';
import type { Customer, HistoricalSale, HistoricalSalesPreview, Invoice } from '../../types/domain';
import { asAppError } from '../../types/domain';
import { money } from '../../utils/indiaBilling';
import { customerAccounts } from '../../utils/receivables';
import { historicalCustomerGroups, parseCustomerInsights, phoneKey } from '../../utils/historicalSales';
import { captureSession } from '../../utils/sessionBoundary';
import { ui } from '../../styles/ui';
import WorkspaceDialog from '../WorkspaceDialog';
import { Button, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '../ui/primitives';

export default function CustomerInsights() {
    const [customers, setCustomers] = useState<Customer[]>([]),
        [bills, setBills] = useState<Invoice[]>([]),
        [sales, setSales] = useState<HistoricalSale[]>([]);
    const [loading, setLoading] = useState(true),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [notice, setNotice] = useState(''),
        [query, setQuery] = useState('');
    const [payload, setPayload] = useState<unknown>(null),
        [preview, setPreview] = useState<HistoricalSalesPreview | null>(null),
        [links, setLinks] = useState<Record<string, string>>({}),
        [confirmation, setConfirmation] = useState('');
    const [history, setHistory] = useState<ReturnType<typeof historicalCustomerGroups>[number] | null>(null);
    const upload = useRef<HTMLInputElement>(null);
    const selectedCustomer = new URLSearchParams(window.location.search).get('customer') || '';
    async function load() {
        const current = captureSession();
        setLoading(true);
        setError('');
        try {
            const [people, invoices, purchases] = await Promise.all([
                localData.getCustomers(),
                localData.getBills(),
                localData.getHistoricalSales(),
            ]);
            current();
            setCustomers(people);
            setBills(invoices);
            setSales(purchases);
        } catch (failure) {
            if (!asAppError(failure).cancelled) setError(asAppError(failure).message);
        } finally {
            try {
                current();
                setLoading(false);
            } catch {
                /* A session change discards private results. */
            }
        }
    }
    useEffect(() => {
        void load();
    }, []);
    const accounts = customerAccounts(customers, bills),
        groups = historicalCustomerGroups(sales);
    const source = payload ? parseCustomerInsights(payload) : [];
    const sourceGroups = [
        ...new Map(source.map((row) => [phoneKey(row.phone), { name: row.name, phone: row.phone }])).entries(),
    ];
    const match = (name: string, phone: string) =>
        (name + ' ' + phone).toLowerCase().includes(query.trim().toLowerCase());
    const invoiceAccounts = accounts.filter(
        (account) => (!selectedCustomer || account._id === selectedCustomer) && match(account.name, account.mobile)
    );
    const historicalGroups = groups.filter(
        (group) => (!selectedCustomer || group.customerId === selectedCustomer) && match(group.name, group.phone)
    );
    async function review(raw: unknown, nextLinks: Record<string, string>) {
        const current = captureSession();
        setBusy(true);
        setError('');
        try {
            const result = await localData.previewHistoricalSales(raw, nextLinks);
            current();
            setPayload(raw);
            setLinks(nextLinks);
            setPreview(result);
            setConfirmation('');
        } catch (failure) {
            if (!asAppError(failure).cancelled) setError(asAppError(failure).message);
        } finally {
            try {
                current();
                setBusy(false);
            } catch {
                /* Ignore results from a departed account. */
            }
        }
    }
    async function commit() {
        if (!preview) return;
        const current = captureSession();
        setBusy(true);
        setError('');
        try {
            const result = await localData.commitHistoricalSales(payload, links, preview, confirmation);
            current();
            setPreview(null);
            setPayload(null);
            setNotice(
                `${result.imported} historical purchases imported. ${result.duplicates} existing source IDs skipped. No invoices or payments were created.`
            );
            await load();
        } catch (failure) {
            if (!asAppError(failure).cancelled) setError(asAppError(failure).message);
        } finally {
            try {
                current();
                setBusy(false);
            } catch {
                /* Ignore results from a departed account. */
            }
        }
    }
    const totalHistorical = sales.reduce((sum, sale) => sum + sale.amountMinor, 0);
    return (
        <section className={ui('workspace-page page-enter finance-workspace')}>
            <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="text-[10px] font-semibold tracking-[.18em] text-primary uppercase">
                        Customer intelligence
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
                        A clearer view of every customer.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                        See invoiced business and reviewed historical purchases in one place, with their sources kept
                        visible.
                    </p>
                </div>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={busy || loading}
                    startIcon={<FileInput size={17} />}
                    onClick={() => upload.current?.click()}
                >
                    Import Customer Insights
                </Button>
                <input
                    ref={upload}
                    type="file"
                    accept=".json,application/json"
                    aria-label="Import Customer Insights JSON"
                    className="sr-only"
                    onChange={async (event) => {
                        const input = event.currentTarget,
                            file = input.files?.[0];
                        if (!file) return;
                        try {
                            if (file.size > 1_500_000) throw new Error('Choose a JSON export under 1.5 MB.');
                            const raw: unknown = JSON.parse(await file.text());
                            parseCustomerInsights(raw);
                            await review(raw, {});
                        } catch (failure) {
                            setError(asAppError(failure).message);
                        } finally {
                            input.value = '';
                        }
                    }}
                />
            </header>
            {notice && (
                <p role="status" className="mb-5 rounded-xl bg-success/10 p-4 text-sm text-success">
                    {notice}
                </p>
            )}
            {error && !preview && (
                <p role="alert" className="mb-5 rounded-xl bg-danger/10 p-4 text-sm text-danger">
                    {error}
                </p>
            )}
            {loading ? (
                <p role="status" className="py-12 text-center text-muted">
                    Opening customer intelligence…
                </p>
            ) : (
                <>
                    <section aria-label="Customer intelligence overview" className="grid gap-4 sm:grid-cols-3">
                        {[
                            ['Customer profiles', customers.length, 'Your billing customer directory'],
                            ['Imported purchases', sales.length, 'Historical records, separate from invoices'],
                            [
                                'Imported sales value',
                                money(totalHistorical / 100),
                                'Source amounts; no tax or payment status inferred',
                            ],
                        ].map(([label, value, detail]) => (
                            <article key={label} className="rounded-2xl border border-line bg-surface p-6">
                                <span className="text-xs text-muted">{label}</span>
                                <strong className="mt-4 block text-3xl font-semibold tracking-tight text-ink">
                                    {value}
                                </strong>
                                <p className="mt-3 text-xs leading-6 text-muted">{detail}</p>
                            </article>
                        ))}
                    </section>
                    <div className="mt-7 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                        <Search className="shrink-0 text-muted" size={18} />
                        <TextField
                            label="Search customer intelligence"
                            value={query}
                            onChange={(event) => setQuery(String(event.target.value))}
                            fullWidth
                        />
                        {selectedCustomer && (
                            <Button asChild>
                                <Link to="/customer-insights">All customers</Link>
                            </Button>
                        )}
                    </div>
                    <section className="mt-8">
                        <div className="mb-4 flex items-center gap-3">
                            <Users className="text-primary" size={19} />
                            <h2 className="text-lg font-semibold text-ink">Billing relationships</h2>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {invoiceAccounts.map((account) => {
                                const linked = sales.filter((row) => row.customerId === account._id);
                                return (
                                    <article
                                        key={account._id}
                                        className="rounded-2xl border border-line bg-surface p-6"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="font-semibold text-ink">{account.name}</h3>
                                                <p className="mt-2 text-xs text-muted">
                                                    {account.mobile} · {account.email}
                                                </p>
                                            </div>
                                            <Link
                                                to={'/statements?customer=' + encodeURIComponent(account._id)}
                                                aria-label={'Statement for ' + account.name}
                                                className="rounded-lg bg-primary-soft p-2 text-primary"
                                            >
                                                <ChevronRight size={17} />
                                            </Link>
                                        </div>
                                        <dl className="mt-5 grid grid-cols-2 gap-4">
                                            <div>
                                                <dt className="text-xs text-muted">Lifetime invoiced</dt>
                                                <dd className="mt-2 font-semibold text-ink">
                                                    {money(account.invoiced)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted">Outstanding</dt>
                                                <dd className="mt-2 font-semibold text-ink">
                                                    {money(account.outstanding)}
                                                </dd>
                                            </div>
                                        </dl>
                                        {linked.length > 0 && (
                                            <div className="mt-5 rounded-xl bg-primary-soft/60 p-4">
                                                <p className="text-xs leading-6 text-muted">
                                                    {linked.length} explicitly linked historical purchases ·{' '}
                                                    {money(linked.reduce((sum, row) => sum + row.amountMinor, 0) / 100)}
                                                </p>
                                                <Button
                                                    size="small"
                                                    className="mt-2"
                                                    onClick={() => setHistory(historicalCustomerGroups(linked)[0])}
                                                >
                                                    Historical purchase history
                                                </Button>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                            {!invoiceAccounts.length && (
                                <p className="rounded-2xl border border-dashed border-line p-8 text-sm text-muted lg:col-span-2">
                                    {customers.length
                                        ? 'No customer profiles match this view.'
                                        : 'Create billing customers under Customers. Historical imports do not create customer profiles automatically.'}
                                </p>
                            )}
                        </div>
                    </section>
                    <section className="mt-9">
                        <div className="mb-4 flex items-center gap-3">
                            <BarChart3 className="text-primary" size={19} />
                            <h2 className="text-lg font-semibold text-ink">Imported purchase history</h2>
                        </div>
                        <p className="mb-5 max-w-3xl text-sm leading-7 text-muted">
                            These records preserve past purchases from Customer Insights. They do not create invoice
                            numbers, GST entries, payments or receivables. Customer links are assigned only during
                            import review.
                        </p>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {historicalGroups.map((group) => (
                                <article
                                    key={group.customerId || phoneKey(group.phone)}
                                    className="rounded-2xl border border-line bg-surface p-6"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold text-ink">{group.name}</h3>
                                            <p className="mt-2 text-xs text-muted">{group.phone}</p>
                                        </div>
                                        <span className="rounded-md bg-primary-soft px-2 py-1 text-[10px] font-medium text-primary">
                                            {group.customerId ? 'Linked during review' : 'Imported history only'}
                                        </span>
                                    </div>
                                    <p className="mt-5 text-2xl font-semibold tracking-tight text-ink">
                                        {money(group.amountMinor / 100)}
                                    </p>
                                    <p className="mt-2 text-xs text-muted">
                                        {group.count} purchases · Last recorded purchase {group.lastPurchase}
                                    </p>
                                    <Button className="mt-4" onClick={() => setHistory(group)}>
                                        Customer history
                                    </Button>
                                </article>
                            ))}
                            {!historicalGroups.length && (
                                <div className="rounded-2xl border border-dashed border-line p-8 lg:col-span-2">
                                    <h3 className="font-semibold text-ink">Bring the history into BillFlow.</h3>
                                    <p className="mt-3 text-sm leading-7 text-muted">
                                        Import a saved Customer Insights JSON export to bring historical purchases into BillFlow.
                                        Your BillFlow encrypted workspace backup
                                        includes imported purchases and their customer links.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
            <WorkspaceDialog
                open={preview !== null}
                size="document"
                aria-label="Review Customer Insights import"
                onClose={() => {
                    if (!busy) {
                        setPreview(null);
                        setPayload(null);
                        setError('');
                    }
                }}
            >
                <DialogTitle className="flex items-center justify-between gap-4">
                    Review historical purchases
                    <Button
                        aria-label="Cancel import"
                        disabled={busy}
                        onClick={() => {
                            setPreview(null);
                            setPayload(null);
                        }}
                    >
                        <X size={18} />
                    </Button>
                </DialogTitle>
                <DialogContent>
                    <p>
                        {preview?.sourceCount} source purchases · {preview?.records.length} new · {preview?.duplicates}{' '}
                        already imported.
                    </p>
                    <p className="mt-3 text-muted">
                        Existing historical source IDs are skipped. No customers, invoices or payments are created
                        automatically.
                    </p>
                    <div className="mt-6 grid max-h-80 gap-4 overflow-auto">
                        {sourceGroups.slice(0, 100).map(([phone, person]) => (
                            <div key={phone} className="rounded-xl border border-line p-4">
                                <p className="mb-3 text-sm font-medium">
                                    {person.name} · {person.phone}
                                </p>
                                <TextField
                                    select
                                    label={'Link purchases for ' + person.name}
                                    value={links[phone] || ''}
                                    disabled={busy}
                                    onChange={(event) =>
                                        void review(payload, { ...links, [phone]: String(event.target.value) })
                                    }
                                    fullWidth
                                >
                                    <MenuItem value="">Keep as imported history only</MenuItem>
                                    {customers.map((customer) => (
                                        <MenuItem key={customer._id} value={customer._id}>
                                            {customer.name} · {customer.mobile}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </div>
                        ))}
                    </div>
                    {sourceGroups.length > 100 && (
                        <p className="mt-3 text-xs text-muted">
                            Additional customers will remain unlinked. Review their source history after importing.
                        </p>
                    )}
                    <div className="mt-6">
                        <TextField
                            label="Type IMPORT to confirm"
                            value={confirmation}
                            disabled={busy}
                            onChange={(event) => setConfirmation(String(event.target.value))}
                            fullWidth
                        />
                    </div>
                    {error && (
                        <p role="alert" className="mt-4 text-danger">
                            {error}
                        </p>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            setPreview(null);
                            setPayload(null);
                        }}
                    >
                        Cancel import
                    </Button>
                    <Button
                        color="primary"
                        variant="contained"
                        disabled={busy || confirmation !== 'IMPORT' || !preview?.records.length}
                        startIcon={<Check size={16} />}
                        onClick={() => void commit()}
                    >
                        {busy ? 'Saving…' : 'Import historical purchases'}
                    </Button>
                </DialogActions>
            </WorkspaceDialog>
            <WorkspaceDialog
                open={history !== null}
                size="operations"
                aria-label="Historical customer purchases"
                onClose={() => setHistory(null)}
            >
                <DialogTitle>{history?.name} · Historical purchases</DialogTitle>
                <DialogContent>
                    <p className="text-muted">
                        {history?.phone} · {history?.count} purchases
                    </p>
                    <div className="mt-5 grid gap-3">
                        {history?.records
                            .slice()
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((row) => (
                                <article
                                    key={row._id}
                                    className="flex items-center justify-between gap-4 rounded-xl border border-line p-4"
                                >
                                    <div>
                                        <strong className="text-sm">{row.date}</strong>
                                        <p className="mt-1 text-xs text-muted">
                                            {row.name} · Source {row.sourceId}
                                        </p>
                                    </div>
                                    <strong>{money(row.amountMinor / 100)}</strong>
                                </article>
                            ))}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setHistory(null)}>Close history</Button>
                </DialogActions>
            </WorkspaceDialog>
        </section>
    );
}
