import React, { useMemo, useState } from 'react';
import { Button, TextField, MenuItem } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import ArrowForwardRoundedIcon from '@material-ui/icons/ArrowForwardRounded';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Popup from '../../Popup';
import BillingForm from './BillingForm';
import BillList from './BillList';
import InvoiceDrafts from './InvoiceDrafts';
import SalesPreparation from './SalesPreparation';
import { receivableRows } from '../../../utils/receivables';
import { money } from '../../../utils/indiaBilling';

export default function BillContainer() {
    const [openPopup, setOpenPopup] = useState(false);
    const [editingDraft, setEditingDraft] = useState(null);
    const [quotationMode, setQuotationMode] = useState(false);
    const [draftRefresh, setDraftRefresh] = useState(0);
    const [draftNotice, setDraftNotice] = useState('');
    const toggleEditor = open => {
        setOpenPopup(open);
        if (!open) setDraftRefresh(value => value + 1);
    };
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('All');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [sort, setSort] = useState('newest');
    const { bills } = useSelector(state => state.bills);
    const customers = useSelector(state => state.customers);
    const rows = useMemo(() => receivableRows(bills, customers), [bills, customers]);
    const invalidRange = from && to && from > to;
    const filtered = rows.filter(row => !invalidRange && (status === 'All' || row.status === status) &&
        (row.customerName + ' ' + (row.invoiceNumber || '')).toLowerCase().includes(query.trim().toLowerCase()) &&
        (!from || row.date.slice(0, 10) >= from) && (!to || row.date.slice(0, 10) <= to))
        .sort((a, b) => sort === 'balance' ? b.balance - a.balance : sort === 'due' ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999') : b.date.localeCompare(a.date));
    const statuses = ['All', 'Unpaid', 'Partially paid', 'Overdue', 'Paid', 'Cancelled', 'Credited'];
    const total = key => rows.reduce((sum, row) => sum + row[key], 0);
    return <section className='workspace-page page-enter finance-workspace'>
        <header className='finance-heading'><div><span className='workspace-kicker'>REVENUE OPERATIONS / INVOICES</span><h1>Every invoice. In focus.</h1><p>Issue with confidence. Track balances. Keep the full history.</p></div>
            <Button variant='contained' color='primary' startIcon={<AddIcon />} onClick={() => { setQuotationMode(false); setEditingDraft(null); setOpenPopup(true); }}>Create invoice</Button></header>
        <div className='finance-metrics'>{[['Outstanding balance', total('balance'), 'Across all open invoices'], ['Recorded payments', total('paid'), 'Manual receipts, net of reversals'], ['Overdue balance', rows.filter(r => r.overdueDays > 0).reduce((sum, r) => sum + r.balance, 0), 'Ready for follow-up']].map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{money(value)}</strong><small>{detail}</small></article>)}</div>
        <div className='collection-callout'><div><strong>A clearer path to getting paid</strong><p>Review aging balances and prepare a customer reminder.</p></div><Button component={Link} to='/receivables' endIcon={<ArrowForwardRoundedIcon />}>Open collections</Button></div>
        <SalesPreparation refreshKey={draftRefresh} onChanged={() => setDraftRefresh(value => value + 1)} onCreateQuotation={() => { setQuotationMode(true); setEditingDraft(null); setOpenPopup(true); }} onResumeDraft={draft => { setQuotationMode(false); setEditingDraft(draft); setOpenPopup(true); }} />
        <InvoiceDrafts refreshKey={draftRefresh} onResume={draft => { setQuotationMode(false); setEditingDraft(draft); setOpenPopup(true); }} />
        {draftNotice && <p role='status' className='draft-message'>{draftNotice}</p>}
        <section className='finance-panel'>
            <div className='invoice-tabs' role='group' aria-label='Filter invoice status'>{statuses.map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)} className={status === value ? 'selected' : ''}>{value}<span>{value === 'All' ? rows.length : rows.filter(row => row.status === value).length}</span></button>)}</div>
            <div className='invoice-filter-grid'>
                <TextField id='invoice-search' label='Customer or invoice number' size='small' value={query} onChange={e => setQuery(e.target.value)} />
                <TextField id='invoice-from' label='Issued from' type='date' size='small' InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
                <TextField id='invoice-to' label='Issued through' type='date' size='small' InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
                <TextField id='invoice-sort' select label='Sort by' size='small' value={sort} onChange={e => setSort(e.target.value)}><MenuItem value='newest'>Newest first</MenuItem><MenuItem value='due'>Due date</MenuItem><MenuItem value='balance'>Highest balance</MenuItem></TextField>
                <Button onClick={() => { setQuery(''); setStatus('All'); setFrom(''); setTo(''); setSort('newest'); }}>Reset</Button>
            </div>
            {invalidRange && <p role='alert'>The start date must be on or before the end date.</p>}
            <div className='result-summary'><span>{filtered.length} of {rows.length} invoices</span><strong>Filtered balance {money(filtered.reduce((sum, r) => sum + r.balance, 0))}</strong></div>
            {filtered.length ? <BillList searchResult={filtered} /> : <div className='finance-empty'><h3>{rows.length ? 'No invoices match this view' : 'Your next sale starts here'}</h3><p>{rows.length ? 'Clear a filter or try another customer name.' : 'Add a customer and a product, then create your first invoice.'}</p>{!rows.length && <Button component={Link} to='/customer'>Set up customers</Button>}</div>}
        </section>
        <Popup title={quotationMode ? 'Quotation studio' : editingDraft ? 'Resume invoice draft' : 'Invoice studio'} size='invoice' openPopup={openPopup} setOpenPopup={toggleEditor}><BillingForm key={editingDraft?._id || (quotationMode ? 'quotation' : 'new')} quotationMode={quotationMode} initialDraft={editingDraft} onQuotationSaved={quote => setDraftNotice(`${quote.number} saved as an offer. No sale was recorded.`)} onTemplateSaved={() => setDraftRefresh(value => value + 1)} onDraftSaved={draft => { setDraftNotice(`“${draft.title}” saved as a draft. No invoice number or receivable was created.`); }} setOpenPopup={toggleEditor} /></Popup>
    </section>;
}
