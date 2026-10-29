import { ui } from '../../../styles/ui';
import { Plus as AddIcon, ArrowRight as ArrowForwardRoundedIcon } from 'lucide-react';
import { Button, TextField, MenuItem } from '../../ui/primitives';
import { useAppSelector as useSelector } from '../../../Redux/hooks';
import type { Draft } from '../../../types/domain';
import React, { useEffect, useMemo, useState } from 'react';

import { Link, useHistory, useLocation } from 'react-router-dom';

import Popup from '../../Popup';
import BillingForm from './BillingForm';
import BillList from './BillList';
import InvoiceDrafts from './InvoiceDrafts';
import SalesPreparation from './SalesPreparation';
import { receivableRows } from '../../../utils/receivables';
import {totalAmounts} from '../../../utils/overview';
import { money } from '../../../utils/indiaBilling';

export default function BillContainer() {
    const history=useHistory(), location=useLocation();
    const params=new URLSearchParams(location.search);
    const requestedView=params.get('view');
    const view=requestedView==='drafts'||requestedView==='quotations'?requestedView:'invoices';
    const setView=(next:string)=>{const query=new URLSearchParams(location.search);query.set('view',next);history.replace({pathname:location.pathname,search:query.toString()});};
    const [openPopup, setOpenPopup] = useState(false);
    const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
    const [quotationMode, setQuotationMode] = useState(false);
    const [draftRefresh, setDraftRefresh] = useState(0);
    const [draftNotice, setDraftNotice] = useState('');
    const compose=new URLSearchParams(location.search).get('compose');
    useEffect(()=>{
        if(compose!=='invoice'&&compose!=='quotation')return;
        if(!openPopup){document.getElementById(compose==='invoice'?'sales-create-invoice':'sales-create-quotation')?.focus();setQuotationMode(compose==='quotation');setEditingDraft(null);setOpenPopup(true);}
        const query=new URLSearchParams(location.search);query.delete('compose');
        history.replace({pathname:location.pathname,search:query.toString()});
    },[compose,history,location.pathname,location.search,openPopup]);
    const toggleEditor = (open: boolean) => {
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
    const total = (key: 'balance' | 'paid') => totalAmounts(rows.map(row=>row[key]));
    return <section className={ui("workspace-page page-enter finance-workspace")}>
        <header className='mb-6 flex flex-wrap items-end justify-between gap-5'><div><p className='text-[10px] font-semibold tracking-[.18em] text-muted uppercase'>Workspace / Sales</p><h1 className='mt-2 text-[clamp(1.7rem,3vw,2.3rem)] font-semibold text-ink'>Your sales workspace.</h1><p className='mt-2 text-sm text-muted'>From first offer to final payment, with the full history in view.</p></div><div className='flex flex-wrap gap-2'>
            <Button id='sales-create-quotation' variant='outlined' color='primary' onClick={()=>{setQuotationMode(true);setEditingDraft(null);setOpenPopup(true);}}>Create quotation</Button>
            <Button id='sales-create-invoice' variant='contained' color='primary' startIcon={<AddIcon />} onClick={() => { setQuotationMode(false); setEditingDraft(null); setOpenPopup(true); }}>Create invoice</Button></div></header>
        <div className={ui("finance-metrics")}>{[['Outstanding balance', total('balance'), 'Across all open invoices'], ['Recorded payments', total('paid'), 'Manual receipts, net of reversals'], ['Overdue balance', totalAmounts(rows.filter(r=>r.overdueDays>0).map(r=>r.balance)), 'Ready for follow-up']].map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{money(value)}</strong><small>{detail}</small></article>)}</div>
        <div className={ui("collection-callout")}><div><strong>A clearer path to getting paid</strong><p>Review aging balances and prepare a customer reminder.</p></div><Button asChild  endIcon={<ArrowForwardRoundedIcon />}><Link to='/receivables'>Open collections</Link></Button></div>
        <nav aria-label='Billing views' className='my-6 flex gap-2 overflow-x-auto border-b border-line pb-3'>
            {[['invoices','Issued invoices'],['drafts','Saved drafts'],['quotations','Offers & templates']].map(([key,label])=><Link key={key} to={{pathname:location.pathname,search:'?view='+key}} aria-current={view===key?'page':undefined} className={'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors '+(view===key?'bg-primary-soft text-primary':'text-muted hover:bg-primary-soft/50 hover:text-ink')}>{label}</Link>)}
        </nav>
        {view==='quotations' && <>
        <SalesPreparation hideCreateAction refreshKey={draftRefresh} onChanged={() => setDraftRefresh(value => value + 1)} onCreateQuotation={() => { setQuotationMode(true); setEditingDraft(null); setOpenPopup(true); }} onResumeDraft={draft => { setQuotationMode(false); setEditingDraft(draft); setOpenPopup(true); }} />
        </>}
        {view==='drafts' && <>
        <InvoiceDrafts refreshKey={draftRefresh} onResume={draft => { setQuotationMode(false); setEditingDraft(draft); setOpenPopup(true); }} />
        </>}
        {draftNotice && <p role='status' className={ui("draft-message")}>{draftNotice}</p>}
        {view==='invoices' && <section className={ui("finance-panel")}>
            <div className={ui("invoice-tabs")} role='group' aria-label='Filter invoice status'>{statuses.map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)} className={ui(status === value ? 'selected' : '')}>{value}<span>{value === 'All' ? rows.length : rows.filter(row => row.status === value).length}</span></button>)}</div>
            <div className={ui("invoice-filter-grid")}>
                <TextField id='invoice-search' label='Customer or invoice number' size='small' value={query} onChange={e => setQuery(e.target.value)} />
                <TextField id='invoice-from' label='Issued from' type='date' size='small' InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
                <TextField id='invoice-to' label='Issued through' type='date' size='small' InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
                <TextField id='invoice-sort' select label='Sort by' size='small' value={sort} onChange={e => setSort(e.target.value)}><MenuItem value='newest'>Newest first</MenuItem><MenuItem value='due'>Due date</MenuItem><MenuItem value='balance'>Highest balance</MenuItem></TextField>
                <Button onClick={() => { setQuery(''); setStatus('All'); setFrom(''); setTo(''); setSort('newest'); }}>Reset</Button>
            </div>
            {invalidRange && <p role='alert'>The start date must be on or before the end date.</p>}
            <div className={ui("result-summary")}><span>{filtered.length} of {rows.length} invoices</span><strong>Filtered balance {money(totalAmounts(filtered.map(row=>row.balance)))}</strong></div>
            {filtered.length ? <BillList searchResult={filtered} /> : <div className={ui("finance-empty")}><h3>{rows.length ? 'No invoices match this view' : 'Your next sale starts here'}</h3><p>{rows.length ? 'Clear a filter or try another customer name.' : 'Add a customer and a product, then create your first invoice.'}</p>{!rows.length && <Button asChild ><Link to='/customer'>Set up customers</Link></Button>}</div>}
        </section>}
        <Popup title={quotationMode ? 'Quotation studio' : editingDraft ? 'Resume invoice draft' : 'Invoice studio'} size='invoice' openPopup={openPopup} setOpenPopup={toggleEditor}><BillingForm key={editingDraft?._id || (quotationMode ? 'quotation' : 'new')} quotationMode={quotationMode} initialDraft={editingDraft} onQuotationSaved={quote => {setView('quotations');setDraftNotice(`${quote.number} saved as an offer. No sale was recorded.`);}} onTemplateSaved={() => setDraftRefresh(value => value + 1)} onDraftSaved={draft => { setView('drafts'); setDraftNotice(`“${draft.title}” saved as a draft. No invoice number or receivable was created.`); }} setOpenPopup={toggleEditor} /></Popup>
    </section>;
}
