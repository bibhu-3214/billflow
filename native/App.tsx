import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Client, Row } from './src/client';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);
const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const paid = (b: Row) => (b.payments || []).filter((p: Row) => !(b.reversals || []).some((r: Row) => r.paymentId === p._id)).reduce((sum: number, p: Row) => sum + Math.round(p.amount * 100), 0) / 100;
const balance = (b: Row) => b.cancellation || b.creditNote ? 0 : Math.max(0, b.total - paid(b));
const Theme = createContext(stylesFor(false));

function Button({ title, action, disabled = false, quiet = false }: { title: string; action(): void; disabled?: boolean; quiet?: boolean }) {
    const s = useContext(Theme);
    return <Pressable accessibilityRole='button' accessibilityState={{ disabled }} onPress={action} disabled={disabled} style={[s.button, quiet && s.quiet, disabled && { opacity: .45 }]}><Text style={quiet ? s.text : s.buttonText}>{title}</Text></Pressable>;
}
function Field({ label, value, change, secure = false }: { label: string; value: unknown; change(value: string): void; secure?: boolean }) {
    const s = useContext(Theme);
    return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={String(value ?? '')} onChangeText={change} secureTextEntry={secure} autoCapitalize='none' autoCorrect={false} /></View>;
}
function Choice({ label, value, options, change }: { label: string; value: string; options: Row[]; change(value: string): void }) {
    const s = useContext(Theme); const [open, setOpen] = useState(false);
    return <View style={s.field}><Text style={s.label}>{label}</Text><Button quiet title={options.find(o => o.value === value)?.label || 'Choose…'} action={() => setOpen(true)} /><Modal visible={open} animationType='slide' onRequestClose={() => setOpen(false)}><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Text style={s.title}>{label}</Text>{options.map(o => <Button key={o.value} quiet title={o.label} action={() => { change(o.value); setOpen(false); }} />)}<Button title='Cancel' action={() => setOpen(false)} /></ScrollView></SafeAreaView></Modal></View>;
}
function Card({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
    const s = useContext(Theme); return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{note ? <Text style={s.muted}>{note}</Text> : null}{children}</View>;
}
function Access({ client, ready }: { client: Client; ready(): Promise<void> }) {
    const s = useContext(Theme); const [mode, setMode] = useState('login'); const [v, setV] = useState<Row>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
    const field = (key: string, label: string) => <Field key={key} label={label} secure={key === 'password'} value={v[key]} change={value => setV(old => ({ ...old, [key]: value }))} />;
    const run = async () => {
        if (busy) return; setBusy(true); setMessage('');
        try {
            const action = ({ login: 'login', signup: 'signup', recovery: 'password/request', verify: 'email/verify', reset: 'password/reset' } as Row)[mode];
            const result = await client.auth(action, mode === 'verify' ? { key: v.key } : mode === 'reset' ? { key: v.key, password: v.password } : mode === 'recovery' ? { email: v.email } : v);
            setV(old => ({ ...old, password: '', key: '' }));
            if (mode === 'login' && result.status === 200) await ready();
            else setMessage(['login', 'signup'].includes(mode) ? 'Check your verification email, then sign in.' : mode === 'recovery' ? 'If this account exists, a recovery email will arrive shortly.' : 'Saved. You can now sign in.');
        } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
    };
    return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps='handled'><Text style={s.brand}>BillFlow</Text><Text style={s.kicker}>BUSINESS, IN FOCUS.</Text><Text style={s.hero}>A clearer day for your business.</Text><Text style={s.muted}>Customers, invoices and the next important thing. One considered workspace.</Text><Card title={mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Your free workspace' : 'Account access'}>
        {!['verify', 'reset'].includes(mode) && field('email', 'Email')}{['login', 'signup', 'reset'].includes(mode) && field('password', 'Password · at least 12 characters')}
        {mode === 'signup' && <>{field('username', 'Your name')}{field('businessName', 'Business name')}{field('address', 'Business address')}</>}
        {['verify', 'reset'].includes(mode) && <><Text style={s.small}>Paste the private key from your BillFlow email link.</Text>{field('key', mode === 'verify' ? 'Verification key' : 'Reset key')}</>}
        {message ? <Text accessibilityRole='alert' style={s.notice}>{message}</Text> : null}<Button disabled={busy} title={busy ? 'Working…' : 'Continue'} action={run} />
        {Object.entries({ login: 'Sign in', signup: 'Create an account', recovery: 'Forgot password?', verify: 'Verify email', reset: 'Use a reset key' }).filter(([key]) => key !== mode).map(([key, label]) => <Button key={key} quiet title={label} disabled={busy} action={() => { setMode(key); setMessage(''); setV(old => ({ ...old, password: '', key: '' })); }} />)}
        </Card><Text style={s.small}>Free first release. No payment card required. Native Google and Apple sign-in still require provider setup and device validation.</Text></ScrollView></KeyboardAvoidingView>;
}
const fields: Record<string, [string, string][]> = {
    customer: [['name', 'Customer name'], ['email', 'Email'], ['mobile', 'Phone'], ['company', 'Company'], ['contactPerson', 'Contact person'], ['address', 'Billing address'], ['state', 'State code'], ['gstin', 'GSTIN'], ['notes', 'Internal notes']],
    product: [['name', 'Product name'], ['price', 'Price · INR'], ['sku', 'SKU'], ['category', 'Category'], ['unit', 'Unit'], ['hsn', 'HSN / SAC'], ['gstRate', 'GST · percent'], ['description', 'Internal description']],
    settings: [['name', 'Business name'], ['address', 'Business address'], ['gstin', 'GSTIN'], ['state', 'State code'], ['dueDays', 'Payment due in days'], ['terms', 'Payment terms'], ['bankDetails', 'Bank / UPI instructions']],
    stock: [['delta', 'Whole-unit movement · negative for reductions'], ['reorderLevel', 'Reorder threshold'], ['reason', 'Reason']],
    followup: [['title', 'Follow-up title'], ['dueDate', 'Date · YYYY-MM-DD'], ['notes', 'Preparation notes']],
    payment: [['amount', 'Payment amount · INR'], ['date', 'Payment date · YYYY-MM-DD'], ['reference', 'Reference']],
    correction: [['reason', 'Correction reason']], status: [['outcome', 'Outcome / reason']],
};
function Editor({ editor, w, close, save, client }: { editor: Row; w: Row; close(): void; save(action: string, args: unknown[]): Promise<void>; client: Client }) {
    const s = useContext(Theme); const { kind, record: r = {} } = editor; const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
    const [v, setV] = useState<Row>(() => ({ date: today(), dueDate: '', dueDays: 0, lineItems: [], gst: Boolean(w.settings.gstin), supplierGSTIN: w.settings.gstin || '', supplierState: w.settings.state || '', ...r }));
    const [preview, setPreview] = useState<Row | null>(null);
    useEffect(() => setPreview(null), [v]);
    const set = (key: string, value: unknown) => { setPreview(null); setV(old => ({ ...old, [key]: value })); };
    const field = (key: string, label: string) => <Field key={key} label={label} value={v[key]} change={value => set(key, value)} />;
    const choice = (key: string, label: string, options: string[]) => <Choice label={label} value={v[key] || ''} options={options.map(value => ({ value, label: value }))} change={value => set(key, value)} />;
    const customer = <Choice label='Customer' value={v.customer || ''} options={w.customers.map((c: Row) => ({ value: c._id, label: c.name }))} change={id => { const c = w.customers.find((row: Row) => row._id === id); setV(old => ({ ...old, customer: id, billingAddress: c?.address || '', customerGSTIN: c?.gstin || '', placeOfSupply: c?.state || '' })); }} />;
    const submit = async () => {
        if (busy) return; setBusy(true); setMessage('');
        try {
            let action = ''; let args: unknown[] = [];
            if (['customer', 'product'].includes(kind)) { action = (r._id ? 'edit' : 'add') + (kind === 'customer' ? 'Customer' : 'Product'); args = r._id ? [r._id, v] : [v]; }
            else if (kind === 'settings') { action = 'saveSettings'; args = [v]; }
            else if (kind === 'stock') { action = 'recordStockMovement'; args = [{ ...v, revision: r.revision || 0, type: v.type || (r.revision ? 'adjustment' : 'opening') }]; }
            else if (kind === 'followup') { action = 'saveFollowUp'; args = [v, r._id || null, r.revision || null]; }
            else if (kind === 'status') { action = 'setFollowUpStatus'; args = [r._id, r.revision, r.status === 'open' ? 'completed' : 'open', v.outcome]; }
            else if (kind === 'payment') { action = 'recordPayment'; args = [r._id, v]; }
            else if (kind === 'correction') { action = 'correctInvoice'; args = [r._id, v]; }
            else if (kind === 'draft') { action = 'saveInvoiceDraft'; args = [v, r._id || null, r.revision || null]; }
            else if (kind === 'quote') { action = 'saveQuotation'; args = [v]; }
            else if (kind === 'template') { action = 'saveInvoiceTemplate'; args = [v]; }
            else if (kind === 'invoice') { action = 'addBill'; args = [{ ...v, ...(r._id && !r.quotationId ? { draftId: r._id, draftRevision: r.revision } : {}) }]; }
            await save(action, args); close();
        } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
    };
    const confirm = async () => {
        if (kind === 'invoice' && !preview) {
            setBusy(true); setMessage('');
            try { setPreview(await client.request('/api/v1/invoices/preview', 'POST', { ...v, ...(r._id && !r.quotationId ? { draftId: r._id, draftRevision: r.revision } : {}) })); }
            catch (err) { setMessage((err as Error).message); }
            finally { setBusy(false); }
            return;
        }
        if (['invoice', 'quote', 'payment', 'correction', 'stock', 'status'].includes(kind)) Alert.alert('Confirm this record', kind === 'invoice' ? 'Issue the reviewed invoice? Issued documents cannot be deleted.' : 'Save this business record? Payment entries do not move money. History is retained.', [{ text: 'Review', style: 'cancel' }, { text: 'Confirm', onPress: submit }]);
        else submit();
    };
    const discard = () => { if (!busy) Alert.alert('Discard unsaved changes?', 'Entries are saved only after Save.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: close }]); };
    return <Modal visible animationType='slide' onRequestClose={discard}><SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps='handled'><Text style={s.kicker}>YOUR OPERATIONS DESK</Text><Text style={s.title}>{editor.title}</Text><View pointerEvents={busy ? 'none' : 'auto'}>
        {(fields[kind] || []).map(([key, label]) => field(key, label))}
        {kind === 'followup' && <>{customer}{choice('channel', 'Channel', ['Phone', 'WhatsApp', 'Email', 'In person'])}{choice('purpose', 'Purpose', ['Collection', 'Order enquiry', 'Account review'])}{choice('priority', 'Priority', ['Normal', 'High'])}</>}
        {kind === 'stock' && r.revision ? choice('type', 'Movement type', ['adjustment', 'threshold']) : null}
        {kind === 'payment' && choice('method', 'Payment method', ['UPI', 'Bank transfer', 'Cash', 'Card', 'Cheque'])}
        {kind === 'correction' && <>{choice('action', 'Correction', ['cancel', 'credit', 'reverse'])}{v.action === 'reverse' && <Choice label='Payment to reverse' value={v.paymentId || ''} options={(r.payments || []).filter((p: Row) => !(r.reversals || []).some((rev: Row) => rev.paymentId === p._id)).map((p: Row) => ({ value: p._id, label: p.date + ' · ' + money(p.amount) }))} change={value => set('paymentId', value)} />}</>}
        {['invoice', 'draft', 'quote', 'template'].includes(kind) && <>{field('title', 'Internal reference / template name')}
            {kind !== 'template' && <>{!r.quotationId && customer}{field('date', 'Date · YYYY-MM-DD')}{field('dueDate', kind === 'quote' ? 'Valid until · YYYY-MM-DD' : 'Due date · YYYY-MM-DD')}{!r.quotationId && field('billingAddress', 'Billing address')}<View style={s.row}><Text style={s.text}>GST registered supplier</Text><Switch accessibilityLabel='GST registered supplier' disabled={Boolean(r.quotationId)} value={Boolean(v.gst)} onValueChange={value => set('gst', value)} /></View>{v.gst && <>{field('supplierGSTIN', 'Supplier GSTIN')}{field('supplierState', 'Supplier state code')}{field('customerGSTIN', 'Customer GSTIN')}{field('placeOfSupply', 'Place of supply · state code')}</>}</>}
            {(v.lineItems || []).map((item: Row, i: number) => <Card key={i} title={item.name || 'Line item'} note={money(item.price)}>
                {Object.entries({ quantity: 'Whole-unit quantity', discount: 'Discount · percent', gstRate: 'GST · percent', unit: 'Unit', hsn: 'HSN / SAC' }).map(([key, label]) => <Field key={key} label={label} value={item[key]} change={value => set('lineItems', v.lineItems.map((row: Row, index: number) => index === i ? { ...row, [key]: value } : row))} />)}
                {!r.quotationId && <Button quiet title='Remove line' action={() => set('lineItems', v.lineItems.filter((_: Row, index: number) => index !== i))} />}</Card>)}
            {!r.quotationId && <Choice label='Add a product' value='' options={w.products.map((p: Row) => ({ value: p._id, label: p.name + ' · ' + money(p.price) }))} change={id => { const p = w.products.find((row: Row) => row._id === id); set('lineItems', [...v.lineItems, { product: id, name: p.name, price: p.price, quantity: '1', discount: '0', gstRate: p.gstRate ?? '', unit: p.unit || 'NOS', hsn: p.hsn || '' }]); }} />}
            {field('notes', 'Notes')}<Text style={s.small}>The server validates prices and taxes when saving. Invoices do not reserve or deduct stock.</Text></>}
        </View>{preview && <Card title='Review invoice totals'><Text style={s.text}>Taxable: {money(preview.taxable)}</Text><Text style={s.text}>CGST: {money(preview.cgst)} · {preview.localTax}: {money(preview.stateTax)}</Text><Text style={s.text}>IGST: {money(preview.igst)}</Text><Text style={s.amount}>{money(preview.total)}</Text><Text style={s.small}>Preview only. No invoice number has been reserved.</Text></Card>}{message ? <Text accessibilityRole='alert' style={s.notice}>{message}</Text> : null}<Button title={busy ? 'Working…' : kind === 'invoice' ? preview ? 'Issue reviewed invoice' : 'Review invoice totals' : 'Save record'} disabled={busy} action={confirm} /><Button quiet title='Close editor' disabled={busy} action={discard} /></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
function Desk({ client, result, reload, signedOut }: { client: Client; result: Row; reload(): Promise<void>; signedOut(): void }) {
    const s = useContext(Theme); const [tab, setTab] = useState('Today'); const [mode, setMode] = useState('Invoices'); const [search, setSearch] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [editor, setEditor] = useState<Row | null>(null); const [invoice, setInvoice] = useState<Row | null>(null);
    const w = result.workspace; const settings = { name: result.profile.businessName, address: result.profile.address, dueDays: 0, ...w.settings };
    const open = (kind: string, title: string, record: Row = {}) => setEditor({ kind, title, record });
    const save = async (action: string, args: unknown[]) => { await client.command(action, args); await reload(); };
    const refresh = async () => { if (busy) return; setBusy(true); try { await reload(); setMessage(''); } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); } };
    const confirm = (action: string, args: unknown[], note: string) => Alert.alert('Confirm action', note, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: async () => { if (busy) return; setBusy(true); try { await save(action, args); } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); } } }]);
    const matches = (row: Row) => JSON.stringify([row.name, row.title, row.number, row.invoiceNumber]).toLowerCase().includes(search.toLowerCase());
    const overdue = w.bills.filter((b: Row) => b.dueDate && b.dueDate < today() && balance(b) > 0);
    const sales = ({ Invoices: w.bills, Drafts: w.invoiceDrafts, Quotations: w.quotations, Templates: w.invoiceTemplates } as Row)[mode] as Row[];
    return <View style={s.screen}><View style={s.header}><View><Text style={s.brand}>BillFlow</Text><Text style={s.small} numberOfLines={1}>{settings.name}</Text></View><Text style={s.kicker}>CONNECTED</Text></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps='handled' refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}><Text style={s.kicker}>YOUR OPERATIONS DESK</Text><Text style={s.title}>{tab === 'Today' ? 'Your business, in focus.' : tab}</Text>{message ? <Text accessibilityRole='alert' style={s.notice}>{message}</Text> : null}
        {tab === 'Today' && <><View style={s.metric}><Text style={s.label}>OUTSTANDING</Text><Text style={s.amount}>{money(w.bills.reduce((sum: number, b: Row) => sum + balance(b), 0))}</Text><Text style={s.muted}>{w.bills.length} invoices · {overdue.length} overdue</Text></View><Button title='Create invoice' action={() => open('invoice', 'New invoice')} /><Button quiet title='Save an invoice draft' action={() => open('draft', 'New invoice draft')} /><Card title='Collections'>{overdue.slice(0, 5).map((b: Row) => <Button quiet key={b._id} title={b.invoiceNumber + ' · ' + money(balance(b))} action={() => setInvoice(b)} />)}{!overdue.length && <Text style={s.muted}>No recorded overdue balances.</Text>}</Card><Card title='Next conversations'>{w.followUps.filter((f: Row) => f.status === 'open').sort((a: Row, b: Row) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4).map((f: Row) => <Button quiet key={f._id} title={f.dueDate + ' · ' + f.customerName + ' · ' + f.title} action={() => open('followup', 'Edit follow-up', f)} />)}<Button quiet title='Plan a customer conversation' action={() => open('followup', 'New follow-up')} /><Text style={s.small}>Manual tasks. No messages are sent.</Text></Card><Card title='Stock attention'>{w.stockRecords.filter((r: Row) => r.onHand <= r.reorderLevel).map((r: Row) => <Text key={r.product} style={s.text}>{r.name}: {r.onHand} {r.unit}</Text>)}<Text style={s.small}>Uncounted stock remains unknown.</Text></Card></>}
        {['Sales', 'Customers', 'Products'].includes(tab) && <Field label='Search records' value={search} change={setSearch} />}
        {tab === 'Sales' && <><View style={s.wrap}>{['Invoices', 'Drafts', 'Quotations', 'Templates'].map(name => <Button key={name} quiet={mode !== name} title={name} action={() => setMode(name)} />)}</View><Button title='Create new record' action={() => open(({ Invoices: 'invoice', Drafts: 'draft', Quotations: 'quote', Templates: 'template' } as Row)[mode], 'New ' + mode.toLowerCase())} />
            {sales.filter(matches).slice().reverse().map(r => <Card key={r._id} title={r.invoiceNumber || r.number || r.title || 'Legacy invoice'} note={mode === 'Invoices' ? r.date.slice(0, 10) + ' · ' + money(r.total) + ' · Due ' + money(balance(r)) : (r.status || 'Saved') + ' · revision ' + r.revision}>
                {mode === 'Invoices' && <Button quiet title='Review invoice' action={() => setInvoice(r)} />}
                {mode === 'Drafts' && <><Button quiet title='Resume draft' action={() => open('draft', 'Edit draft', r)} /><Button title='Review for issuance' action={() => open('invoice', 'Issue saved draft', r)} /><Button quiet title='Duplicate draft' action={() => confirm('duplicateInvoiceDraft', [r._id, r.revision], 'Create a fresh draft with no due date?')} /><Button quiet title='Remove draft' action={() => confirm('removeInvoiceDraft', [r._id, r.revision], 'Remove the draft? Issued invoices are retained.')} /></>}
                {mode === 'Quotations' && <>{r.status === 'open' && <><Button quiet title='Record acceptance' action={() => confirm('setQuotationStatus', [r._id, r.revision, 'accepted'], 'Record manual customer acceptance? This cannot be undone.')} /><Button quiet title='Record rejection' action={() => confirm('setQuotationStatus', [r._id, r.revision, 'rejected'], 'Record rejection? This cannot be undone.')} /></>}{r.status === 'accepted' && <Button title='Convert to invoice' action={() => open('invoice', 'Convert accepted quotation', { ...r, quotationId: r._id, quotationRevision: r.revision, date: today(), dueDate: '' })} />}<Text style={s.small}>{r.lineItems.map((line: Row) => line.quantity + ' × ' + line.name).join(' · ')}</Text></>}
                {mode === 'Templates' && <><Button quiet title='Create a fresh draft' action={() => confirm('draftFromTemplate', [r._id], 'Create a draft at current prices?')} /><Button quiet title='Remove template' action={() => confirm('removeInvoiceTemplate', [r._id], 'Remove this template? Existing documents stay intact.')} /></>}
            </Card>)}{!sales.length && <Text style={s.muted}>Start with your first record. Saved work appears here.</Text>}</>}
        {tab === 'Customers' && <><Button title='Add customer' action={() => open('customer', 'New customer')} />{w.customers.filter(matches).map((c: Row) => <Card key={c._id} title={c.name} note={c.mobile + ' · ' + (c.email || 'No email')}><Text style={s.muted}>Outstanding {money(w.bills.filter((b: Row) => b.customer === c._id).reduce((sum: number, b: Row) => sum + balance(b), 0))}</Text><Button quiet title='Edit profile' action={() => open('customer', 'Edit customer', c)} /><Button quiet title='Plan conversation' action={() => open('followup', 'New follow-up', { customer: c._id })} /><Button quiet title='Remove customer' action={() => confirm('removeCustomer', [c._id], 'Remove this customer? Invoice-linked customers are retained.')} /></Card>)}<Text style={s.cardTitle}>Customer conversations</Text>{w.followUps.map((f: Row) => <Card key={f._id} title={f.title} note={f.customerName + ' · ' + f.dueDate + ' · ' + f.status}><Button quiet title='Review / reschedule' action={() => open('followup', 'Edit follow-up', f)} /><Button quiet title={f.status === 'open' ? 'Record outcome' : 'Reopen with reason'} action={() => open('status', 'Follow-up outcome', f)} /></Card>)}</>}
        {tab === 'Products' && <><Button title='Add product' action={() => open('product', 'New product', { unit: 'NOS' })} />{w.products.filter(matches).map((p: Row) => { const stock = w.stockRecords.find((r: Row) => r.product === p._id); return <Card key={p._id} title={p.name} note={money(p.price) + ' · ' + (p.sku || 'No SKU')}><Text style={s.muted}>{stock ? stock.onHand + ' ' + stock.unit + ' counted · reorder ' + stock.reorderLevel : 'Stock not counted'}</Text><Button quiet title='Edit product' action={() => open('product', 'Edit product', p)} /><Button quiet title={stock ? 'Adjust stock' : 'Set opening count'} action={() => open('stock', 'Manual stock movement', { ...stock, product: p._id, delta: '', reorderLevel: stock?.reorderLevel || 0 })} /><Button quiet title='Remove product' action={() => confirm('removeProduct', [p._id], 'Remove this product? Invoice or stock history prevents removal.')} /></Card>; })}</>}
        {tab === 'Settings' && <><Card title={settings.name} note={result.profile.email}><Button title='Business defaults' action={() => open('settings', 'Business settings', settings)} /><Button quiet title='Backups, import and account controls' action={() => Linking.openURL(client.origin + '/settings').catch(() => setMessage('Unable to open the website.'))} /><Text style={s.small}>Advanced recovery and document exports open the website. Sign in there separately; device credentials never appear in links.</Text></Card><Card title='Help and support'><Text style={s.muted}>Payments are manual records. BillFlow does not move money, file taxes or automatically contact customers. Tax classifications need professional review.</Text><Button quiet title='Open Help' action={() => Linking.openURL(client.origin + '/help').catch(() => setMessage('Unable to open Help.'))} /><Button quiet title='Refresh records' action={refresh} /></Card><Button quiet title='Sign out of this device' disabled={busy} action={async () => { setBusy(true); try { await client.signOut(); signedOut(); } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); } }} /><Text style={s.small}>Connected mode requires a network connection. Offline invoice issuance is unavailable.</Text></>}
        </ScrollView><View style={s.tabs}>{['Today', 'Sales', 'Customers', 'Products', 'Settings'].map((name, index) => <Pressable key={name} accessibilityRole='tab' accessibilityState={{ selected: tab === name }} style={s.tab} onPress={() => { setTab(name); setSearch(''); }}><Text style={[s.icon, tab === name && s.selected]}>{['◈', '▤', '◌', '▧', '⚙'][index]}</Text><Text style={[s.tabLabel, tab === name && s.selected]}>{name}</Text></Pressable>)}</View>
        {editor && <Editor client={client} key={editor.kind + (editor.record?._id || '')} editor={editor} w={{ ...w, settings }} close={() => setEditor(null)} save={save} />}
        {invoice && <Modal visible animationType='slide' onRequestClose={() => setInvoice(null)}><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Text style={s.kicker}>ISSUED DOCUMENT</Text><Text style={s.title}>{invoice.invoiceNumber || 'Legacy invoice'}</Text><Text style={s.muted}>{invoice.customerSnapshot?.name || w.customers.find((c: Row) => c._id === invoice.customer)?.name}</Text><Text style={s.amount}>{money(invoice.total)}</Text><Text style={s.muted}>Outstanding {money(balance(invoice))}</Text>{invoice.lineItems.map((line: Row, i: number) => <Card key={i} title={line.name || w.products.find((p: Row) => p._id === line.product)?.name || 'Historical item'} note={line.quantity + ' × ' + money(line.price) + ' · ' + money(line.subTotal)} />)}
            {invoice.cancellation || invoice.creditNote ? <Text style={s.notice}>Closed · {invoice.cancellation?.reason || invoice.creditNote?.reason}</Text> : <><Button title='Record payment' action={() => { const r = invoice; setInvoice(null); open('payment', 'Record payment', { ...r, date: today(), amount: '', reference: '' }); }} /><Button quiet title='Correction / reversal' action={() => { const r = invoice; setInvoice(null); open('correction', 'Invoice correction', r); }} /></>}
            {(invoice.payments || []).map((p: Row) => <Text key={p._id} style={s.text}>{p.date} · {money(p.amount)} · {p.method}{(invoice.reversals || []).some((r: Row) => r.paymentId === p._id) ? ' · reversed' : ''}</Text>)}<Button quiet title='Printable document on web' action={() => Linking.openURL(client.origin + '/billdetails/' + encodeURIComponent(invoice._id)).catch(() => setMessage('Unable to open document.'))} /><Button title='Done' action={() => setInvoice(null)} /></ScrollView></SafeAreaView></Modal>}
    </View>;
}
export default function App() {
    const scheme = useColorScheme();
    const s = useMemo(() => stylesFor(scheme === 'dark'), [scheme]);
    const [client] = useState(() => { try { return new Client(process.env.EXPO_PUBLIC_API_ORIGIN || '', { get: () => SecureStore.getItemAsync('billflow.session'), set: token => SecureStore.setItemAsync('billflow.session', token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), clear: () => SecureStore.deleteItemAsync('billflow.session') }, Crypto.randomUUID, fetch, __DEV__); } catch { return null; } });
    const [result, setResult] = useState<Row | null>(null); const [loading, setLoading] = useState(true); const [failure, setFailure] = useState('');
    const load = async () => { if (client) setResult(await client.workspace()); };
    useEffect(() => { if (client) client.onSessionExpired = () => setResult(null); return () => { if (client) client.onSessionExpired = undefined; }; }, [client]);
    useEffect(() => { let active = true; (async () => { try { if (client) { await client.restore(); const value = await client.workspace(); if (active) setResult(value); } } catch (err) { if (active && !(err as Error).message.includes('session expired')) setFailure((err as Error).message); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [client]);
    return <SafeAreaProvider><Theme.Provider value={s}><SafeAreaView style={s.screen}><StatusBar style='auto' />{loading ? <ActivityIndicator accessibilityLabel='Opening BillFlow' style={{ flex: 1 }} /> : !client ? <View style={s.content}><Text style={s.brand}>BillFlow</Text><Text style={s.hero}>Your next business workspace.</Text><Text style={s.muted}>This development app is waiting for its service connection. Your records remain in the existing BillFlow workspace.</Text></View> : result ? <Desk client={client} result={result} reload={load} signedOut={() => setResult(null)} /> : <><Access client={client} ready={load} />{failure ? <Text accessibilityRole='alert' style={s.notice}>{failure}</Text> : null}</>}</SafeAreaView></Theme.Provider></SafeAreaProvider>;
}
function stylesFor(dark: boolean) {
    const c = dark ? { bg: '#10131d', surface: '#1a1e2b', ink: '#f0f2fa', muted: '#a5aec2', border: '#30374b', input: '#131824' } : { bg: '#f5f6fa', surface: '#ffffff', ink: '#19233c', muted: '#66728a', border: '#e3e7f0', input: '#fbfcfe' };
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: c.bg }, content: { padding: 22, gap: 18, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
        header: { paddingHorizontal: 22, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 },
        brand: { fontSize: 25, fontWeight: '800', letterSpacing: -1, color: c.ink }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#777cf4' },
        hero: { fontSize: 40, fontWeight: '700', letterSpacing: -1.5, color: c.ink, lineHeight: 47 }, title: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: c.ink },
        text: { fontSize: 14, color: c.ink, lineHeight: 23 }, muted: { fontSize: 14, color: c.muted, lineHeight: 22 }, small: { fontSize: 12, color: c.muted, lineHeight: 19 },
        card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 20, gap: 12 }, cardTitle: { fontSize: 18, fontWeight: '600', color: c.ink },
        field: { gap: 8, marginVertical: 6 }, label: { fontSize: 12, fontWeight: '600', color: c.muted }, input: { color: c.ink, fontSize: 16, backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, minHeight: 48 },
        button: { backgroundColor: '#585bd5', borderRadius: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginVertical: 3 }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' }, quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, notice: { fontSize: 14, color: dark ? '#e5c79a' : '#80521e', lineHeight: 22, paddingVertical: 8 },
        metric: { borderRadius: 22, backgroundColor: dark ? '#252956' : '#e9eafd', padding: 25, gap: 12 }, amount: { fontSize: 36, fontWeight: '700', letterSpacing: -1, color: c.ink },
        tabs: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface }, tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 4 }, icon: { fontSize: 22, color: c.muted }, tabLabel: { fontSize: 10, color: c.muted }, selected: { color: '#777cf4', fontWeight: '700' },
    });
}
