import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField, MenuItem } from '@material-ui/core';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import localData from '../../data/localData';
import { today } from '../../utils/indiaBilling';
import Popup, { usePopupForm } from '../Popup';

export function FollowUpEditor({ record, customerId, collectionsOnly, transition, onClose, onSaved }) {
    const customers = useSelector(state => state.customers);
    const unavailableCustomer = record && !customers.some(customer => customer._id === record.customer);
    const [values, setValues] = useState(record ? { ...record, customer: unavailableCustomer ? '' : record.customer } : { customer: customerId || '', title: '', dueDate: today(), priority: 'Normal', channel: 'Phone', purpose: collectionsOnly ? 'Collection' : 'Account review', notes: '' });
    const [outcome, setOutcome] = useState('');
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const close = usePopupForm(dirty, busy);
    const field = (name, label, extra = {}) => <TextField id={'followup-' + name} variant='outlined' fullWidth size='small' label={label} value={values[name]} onChange={event => { setDirty(true); setValues(current => ({ ...current, [name]: event.target.value })); }} {...extra} />;
    const save = async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError('');
        try {
            if (transition) await localData.setFollowUpStatus(record._id, record.revision, transition, outcome);
            else await localData.saveFollowUp(values, record?._id, record?.revision);
            if (mounted.current) { onSaved(); onClose(); }
        } catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    return <form className='operations-editor' onSubmit={save}><span className='workspace-kicker'>CUSTOMER RELATIONSHIPS</span><h2>{transition ? transition === 'completed' ? 'Record the conversation outcome' : 'Reopen this follow-up' : record ? 'Review & reschedule' : 'Plan the next conversation'}</h2><p>{transition ? `${record.title} · ${record.customerName}` : 'Keep the next action clear. This schedules a local task, not a message or notification.'}</p>{error && <p role='alert' className='editor-error'>{error}</p>}
        {unavailableCustomer && !transition && <p className='draft-review-warning' role='status'>The original customer is unavailable. Choose an available customer before saving a revised schedule. Previous activity stays in the history.</p>}
        <fieldset disabled={busy} className='studio-fields'>
            {transition ? <TextField id='followup-outcome' label={transition === 'completed' ? 'Outcome / next steps' : 'Reason for reopening'} fullWidth variant='outlined' required multiline rows={3} value={outcome} inputProps={{ maxLength: 500 }} onChange={event => { setDirty(true); setOutcome(event.target.value); }} /> : <div className='studio-grid'>
                {field('customer', 'Customer', { select: true, required: true, disabled: Boolean(customerId), children: customers.map(customer => <MenuItem key={customer._id} value={customer._id}>{customer.name}</MenuItem>) })}
                {field('title', 'Next action', { required: true, inputProps: { maxLength: 80 } })}
                {field('dueDate', 'Follow-up date', { type: 'date', required: true, InputLabelProps: { shrink: true } })}
                {field('priority', 'Priority', { select: true, children: ['Normal', 'High'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>) })}
                {field('channel', 'Conversation channel', { select: true, children: ['Phone', 'WhatsApp', 'Email', 'In person'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>) })}
                {field('purpose', 'Purpose', { select: true, disabled: collectionsOnly, children: ['Collection', 'Order enquiry', 'Account review'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>) })}
                {field('notes', 'Internal preparation notes', { className: 'editor-wide', multiline: true, rows: 3, inputProps: { maxLength: 1000 } })}
            </div>}
        </fieldset>
        {!!record?.history.length && <details className='operations-history'><summary>Activity history ({record.history.length})</summary>{record.history.slice().reverse().map((event, index) => <article key={index}><strong>{event.action} · {new Date(event.at).toLocaleString('en-IN')}</strong>{event.dueDate && <small>Scheduled {event.dueDate}</small>}<p>{event.outcome}</p></article>)}</details>}
        <footer className='editor-footer'><Button disabled={busy} onClick={() => close ? close() : onClose()}>Cancel</Button><Button type='submit' color='primary' variant='contained' disabled={busy}>{busy ? 'Saving…' : transition ? transition === 'completed' ? 'Complete follow-up' : 'Reopen follow-up' : 'Save follow-up'}</Button></footer>
    </form>;
}

export default function FollowUpDesk({ compact = false, customerId, collectionsOnly = false }) {
    const customers = useSelector(state => state.customers);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [view, setView] = useState('Open');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [editing, setEditing] = useState(null);
    useEffect(() => { const refresh = () => setReload(value => value + 1); window.addEventListener('billflow:followups-changed', refresh); return () => window.removeEventListener('billflow:followups-changed', refresh); }, []);
    useEffect(() => {
        let active = true; setLoading(true); setError('');
        localData.getFollowUps().then(values => { if (active) setRecords(values); }).catch(problem => { if (active) setError(problem.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [reload]);
    const scoped = records.filter(record => (!customerId || record.customer === customerId) && (!collectionsOnly || record.purpose === 'Collection'));
    const open = scoped.filter(record => record.status === 'open');
    const filtered = scoped.filter(record => (compact ? record.status === 'open' : view === 'Completed' ? record.status === 'completed' : record.status === 'open' && (view === 'Open' || (view === 'Overdue' ? record.dueDate < today() : record.dueDate === today()))) && `${record.title} ${record.customerName}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || Number(b.priority === 'High') - Number(a.priority === 'High'));
    const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
    const refresh = () => window.dispatchEvent(new Event('billflow:followups-changed'));
    return <section className='finance-panel operations-desk followup-desk' aria-label={compact ? 'Upcoming customer actions' : 'Customer follow-up desk'}><header className='draft-desk-heading'><div><span className='workspace-kicker'>{collectionsOnly ? 'COLLECTION CONVERSATIONS' : 'RELATIONSHIP OPERATIONS'}</span><h2>{compact ? 'Your next customer conversations' : 'Customer follow-up desk'}</h2><p>{open.length} open · {open.filter(record => record.dueDate < today()).length} overdue · {open.filter(record => record.dueDate === today()).length} due today</p></div>{compact ? <Button component={Link} to='/customer'>Open follow-up desk</Button> : <Button color='primary' variant='outlined' disabled={!customers.length} onClick={() => setEditing({ record: null })}>Plan follow-up</Button>}</header>
        {loading && <p role='status'>Opening follow-ups…</p>}{error && <p role='alert' className='editor-error'>{error} <Button onClick={() => setReload(value => value + 1)}>Reload follow-ups</Button></p>}
        {!compact && <div className='operations-filters'><div className='invoice-tabs' role='group' aria-label='Follow-up views'>{['Open', 'Today', 'Overdue', 'Completed'].map(value => <button key={value} className={value === view ? 'selected' : ''} aria-pressed={value === view} onClick={() => { setView(value); setPage(0); }}>{value}</button>)}</div><TextField id={'followup-search-' + (customerId || 'all') + (collectionsOnly ? '-collections' : '')} label='Find action or customer' size='small' variant='outlined' value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div>}
        {!loading && !error && <div className='operations-list'>{filtered.slice(compact ? 0 : currentPage * 6, compact ? 3 : currentPage * 6 + 6).map(record => <article key={record._id}><div><strong>{record.title}</strong><small>{customers.find(customer => customer._id === record.customer)?.name || `${record.customerName} · Customer unavailable`} · {record.channel} · {record.purpose}</small></div><div><span className={'operations-badge ' + (record.status === 'open' && record.dueDate < today() ? 'warning' : '')}>{record.status === 'completed' ? 'Completed' : record.dueDate < today() ? 'Overdue' : record.dueDate === today() ? 'Today' : 'Upcoming'}</span><small>{record.dueDate} · {record.priority} priority</small></div>{!compact && <div className='operations-row-actions'>{record.status === 'open' && <Button aria-label={`Review follow-up ${record.title}`} onClick={() => setEditing({ record })}>Review</Button>}<Button aria-label={`${record.status === 'open' ? 'Complete' : 'Reopen'} ${record.title}`} onClick={() => setEditing({ record, transition: record.status === 'open' ? 'completed' : 'open' })}>{record.status === 'open' ? 'Complete' : 'Reopen'}</Button></div>}</article>)}</div>}
        {!loading && !error && !filtered.length && <div className='draft-empty'><strong>{view === 'Completed' ? 'No completed conversations in this view.' : 'A clear next action makes relationships stronger.'}</strong><p>{customers.length ? 'Plan a follow-up or change the filter. Nothing is sent automatically.' : 'Add a customer before planning a conversation.'}</p></div>}
        {!compact && filtered.length > 6 && <div className='draft-pagination'><span>{currentPage * 6 + 1}–{Math.min((currentPage + 1) * 6, filtered.length)} of {filtered.length}</span><Button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous actions</Button><Button disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next actions</Button></div>}
        <p className='draft-footnote'>Browser-local tasks, manually recorded outcomes. No calls, WhatsApp messages, emails or background notifications are sent.</p>
        <Popup title={editing?.transition ? 'Follow-up outcome & history' : 'Customer conversation planner'} size='operations' openPopup={Boolean(editing)} setOpenPopup={openPopup => { if (!openPopup) { setEditing(null); refresh(); } }}>{editing && <FollowUpEditor key={(editing.record?._id || 'new') + (editing.transition || '')} {...editing} customerId={customerId} collectionsOnly={collectionsOnly} onSaved={refresh} onClose={() => setEditing(null)} />}</Popup>
    </section>;
}
