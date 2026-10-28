import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@material-ui/core';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import localData from '../../../data/localData';
import { addBill } from '../../../Redux/Actions/billAction';
import { calculateInvoice, money, today } from '../../../utils/indiaBilling';
import Popup, { usePopupForm } from '../../Popup';
import ConfirmAction from '../../ConfirmAction';

export function QuotationReview({ quote, onChanged, onClose }) {
    const dispatch = useDispatch();
    const history = useHistory();
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [date, setDate] = useState(today());
    const [dueDate, setDueDate] = useState(today());
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirm, setConfirm] = useState({ isOpen: false });
    const requestClose = usePopupForm(dirty, busy);
    const expired = quote.dueDate < today();
    const totals = calculateInvoice(quote.lineItems, quote);
    const decide = async status => {
        setConfirm({ isOpen: false }); setBusy(true); setError('');
        try { await localData.setQuotationStatus(quote._id, quote.revision, status); if (mounted.current) { onChanged(); onClose(); } }
        catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    const convert = async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError('');
        const result = await dispatch(addBill({ quotationId: quote._id, quotationRevision: quote.revision, date, dueDate }, id => {
            if (mounted.current) { onChanged(); onClose(); history.push('/billdetails/' + id); }
        }));
        if (mounted.current) { if (!result.ok) setError(result.error); setBusy(false); }
    };
    return <div className='quotation-review'>
        {error && <p role='alert' className='editor-error'>{error} Close and reopen to refresh quotation history.</p>}
        <article className='quotation-print'>
            <span className='workspace-kicker'>SALES OFFER · NOT A TAX INVOICE</span><h2>{quote.number}</h2><p>{quote.title}</p>
            <div className='quote-party-grid'><div><small>FROM</small><h3>{quote.supplierSnapshot.name}</h3><p>{quote.supplierSnapshot.address}</p>{quote.gst && <p>GSTIN: {quote.supplierSnapshot.gstin}</p>}</div><div><small>PREPARED FOR</small><h3>{quote.customerSnapshot.name}</h3><p>{quote.customerSnapshot.address}</p>{quote.customerSnapshot.gstin && <p>GSTIN: {quote.customerSnapshot.gstin}</p>}</div></div>
            <p>Quotation date {quote.date} · Valid until {quote.dueDate}</p><p>Status: {quote.status}{expired && quote.status !== 'converted' ? ' · Expired' : ''}</p>
            <div className='quote-table-scroll'><table><thead><tr><th>Item</th><th>Quantity / unit</th><th>Rate</th><th>Discount</th><th>Amount</th></tr></thead><tbody>{totals.lineItems.map((item, index) => <tr key={index}><td>{item.name}{quote.gst && <small> · HSN {item.hsn} · GST {item.gstRate}%</small>}</td><td>{item.quantity} {item.unit}</td><td>{money(item.price)}</td><td>{item.discount}%</td><td>{money(item.subTotal)}</td></tr>)}</tbody></table></div>
            <div className='quote-totals'><p>Subtotal <strong>{money(totals.gross)}</strong></p><p>Discount <strong>−{money(totals.discountAmount)}</strong></p>{quote.gst && <><p>Taxable value <strong>{money(totals.taxable)}</strong></p><p>{totals.interstate ? 'IGST' : `CGST + ${totals.localTax}`} <strong>{money(totals.igst + totals.cgst + totals.stateTax)}</strong></p><p>Place of supply: {quote.placeOfSupply}</p></>}<p>Quoted total <strong>{money(totals.total)}</strong></p></div>
            <p className='quote-notes'>{quote.notes || 'No additional terms.'}</p><p className='studio-hint'>Acceptance is recorded manually by the workspace operator. This offer does not collect payment, reserve inventory or report GST.</p>
        </article>
        {quote.status === 'accepted' && !expired && <form className='quote-conversion' onSubmit={convert}><h3>Convert this accepted offer</h3><p>Uses the saved quoted prices and party details. Confirm the invoice schedule before issuing.</p><fieldset disabled={busy} className='studio-fields'><div className='studio-grid'><TextField id='quote-invoice-date' label='Invoice date' type='date' required value={date} InputLabelProps={{ shrink: true }} inputProps={{ min: quote.date, max: quote.dueDate }} onChange={event => { setDirty(true); setDate(event.target.value); }} /><TextField id='quote-due-date' label='Payment due date' type='date' required value={dueDate} InputLabelProps={{ shrink: true }} inputProps={{ min: date }} onChange={event => { setDirty(true); setDueDate(event.target.value); }} /></div><Button type='submit' color='primary' variant='contained'>Issue linked invoice</Button></fieldset></form>}
        <footer className='editor-footer quote-actions'><Button disabled={busy} onClick={() => requestClose ? requestClose() : onClose()}>Close</Button><Button disabled={busy} onClick={() => window.print()}>Print quotation</Button>{quote.status === 'converted' && <Button color='primary' onClick={() => { onClose(); history.push('/billdetails/' + quote.invoiceId); }}>View linked invoice</Button>}{quote.status === 'open' && !expired && ['accepted', 'rejected'].map(status => <Button key={status} disabled={busy} onClick={() => setConfirm({ isOpen: true, title: `Record ${status === 'accepted' ? 'acceptance' : 'rejection'}?`, confirmText: 'Confirm decision', cancelText: 'Keep reviewing', subTitle: 'This is a manual record of the customer decision. It cannot be undone; create a new quotation for revised terms.', onConfirm: () => decide(status) })}>{status === 'accepted' ? 'Record acceptance' : 'Record rejection'}</Button>)}</footer>
        <ConfirmAction confirmDialog={confirm} setConfirmDialog={setConfirm} />
    </div>;
}

export default function SalesPreparation({ refreshKey, onCreateQuotation, onResumeDraft, onChanged }) {
    const [tab, setTab] = useState('quotations');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState(false);
    const [quote, setQuote] = useState(null);
    const [confirm, setConfirm] = useState({ isOpen: false });
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        let active = true; setLoading(true); setError(''); setRecords([]);
        (tab === 'quotations' ? localData.getQuotations() : localData.getInvoiceTemplates()).then(values => { if (active) setRecords(values); }).catch(problem => { if (active) setError(problem.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [tab, refreshKey, reload]);
    const refresh = () => { setReload(value => value + 1); onChanged(); };
    const createFromTemplate = async record => {
        if (busy) return; setBusy(true); setError('');
        try { const draft = await localData.draftFromTemplate(record._id); if (mounted.current) { refresh(); onResumeDraft(draft); } }
        catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    const remove = async record => {
        setConfirm({ isOpen: false }); setBusy(true); setError('');
        try { await localData.removeInvoiceTemplate(record._id); if (mounted.current) refresh(); }
        catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    const filtered = records.filter(record => `${record.title} ${record.number || ''} ${record.customerSnapshot?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
    const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
    return <section className='finance-panel sales-preparation' aria-label='Sales preparation'>
        <header className='draft-desk-heading'><div><span className='workspace-kicker'>FROM OFFER TO ORDER</span><h2>Sales preparation</h2><p>Clear offers. Repeatable orders. One connected workflow.</p></div><Button variant='outlined' color='primary' disabled={busy} onClick={onCreateQuotation}>Create quotation</Button></header>
        <div className='invoice-tabs' role='group' aria-label='Preparation views'>{[['quotations', 'Quotations'], ['templates', 'Item templates']].map(([value, label]) => <button key={value} aria-pressed={tab === value} disabled={busy} className={tab === value ? 'selected' : ''} onClick={() => { setRecords([]); setLoading(true); setTab(value); setQuery(''); setPage(0); if (tab === value) setReload(current => current + 1); }}>{label}</button>)}</div>
        <TextField id='preparation-search' label={tab === 'quotations' ? 'Find an offer or customer' : 'Find an item template'} variant='outlined' size='small' value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
        {loading && <p role='status'>Opening {tab}…</p>}{error && <p role='alert' className='editor-error'>{error} <Button disabled={busy} onClick={() => setReload(value => value + 1)}>Reload</Button></p>}
        {!loading && !filtered.length && <div className='draft-empty'><h3>{query ? 'No matches in this view.' : tab === 'quotations' ? 'Your next sale starts with a clear offer.' : 'Make repeat orders effortless.'}</h3><p>{tab === 'quotations' ? 'Prepare an offer, record the customer decision, then issue a linked invoice.' : 'Open the invoice composer, add a named item bundle, then choose Save item template.'}</p></div>}
        {!loading && <div className='draft-card-grid'>{filtered.slice(currentPage * 6, currentPage * 6 + 6).map(record => <article className='draft-card' key={record._id}><div className='draft-card-top'><span className='draft-state'>{tab === 'quotations' ? record.status !== 'converted' && record.dueDate < today() ? 'EXPIRED' : record.status.toUpperCase() : 'REUSABLE ITEM BUNDLE'}</span><small>{record.number}</small></div><h3>{record.title}</h3><p>{record.customerSnapshot?.name || `${record.lineItems.length} catalog items`}</p>{tab === 'quotations' && <><strong>{money(calculateInvoice(record.lineItems, record).total)}</strong><small>Valid until {record.dueDate}</small></>}<footer><Button disabled={busy} variant='outlined' color='primary' size='small' aria-label={`${tab === 'quotations' ? 'Review' : 'Use'} ${record.title}`} onClick={() => tab === 'quotations' ? setQuote(record) : createFromTemplate(record)}>{tab === 'quotations' ? 'Review offer' : 'Create draft'}</Button>{tab === 'templates' && <Button disabled={busy} size='small' aria-label={`Delete template ${record.title}`} onClick={() => setConfirm({ isOpen: true, title: 'Delete item template?', subTitle: 'Existing drafts and invoices remain unchanged.', onConfirm: () => remove(record) })}>Delete</Button>}</footer></article>)}</div>}
        {filtered.length > 6 && <div className='draft-pagination'><span>{currentPage * 6 + 1}–{Math.min((currentPage + 1) * 6, filtered.length)} of {filtered.length}</span><Button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div>}
        <p className='draft-footnote'>{tab === 'quotations' ? 'Offers retain quoted prices. Manual acceptance is not a verified customer signature. No sale is recorded until conversion.' : 'Templates use current catalog prices and require a new customer and schedule. Deleted products must be replaced; no stock is reserved.'}</p>
        <Popup title='Quotation review' size='document' openPopup={Boolean(quote)} setOpenPopup={open => { if (!open) { setQuote(null); refresh(); } }}>{quote && <QuotationReview key={quote._id} quote={quote} onChanged={refresh} onClose={() => setQuote(null)} />}</Popup>
        <ConfirmAction confirmDialog={confirm} setConfirmDialog={setConfirm} />
    </section>;
}
