import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField, IconButton, Tooltip } from '@material-ui/core';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import DeleteOutlineRoundedIcon from '@material-ui/icons/DeleteOutlineRounded';
import localData from '../../../data/localData';
import ConfirmAction from '../../ConfirmAction';
import { calculateInvoice, money } from '../../../utils/indiaBilling';
import { useSelector } from 'react-redux';

const draftAmount = draft => {
    try { return money(calculateInvoice(draft.lineItems, draft).total); }
    catch { return 'Incomplete'; }
};
const savedTime = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Saved time unavailable';
};

export default function InvoiceDrafts({ refreshKey, onResume }) {
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const customers = useSelector(state => state.customers);
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [confirm, setConfirm] = useState({ isOpen: false });
    useEffect(() => {
        let active = true;
        setLoading(true); setLoadError('');
        localData.getInvoiceDrafts().then(records => { if (active) setDrafts(records); })
            .catch(problem => { if (active) setLoadError(problem.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [refreshKey, reload]);
    const customerName = draft => customers.find(customer => customer._id === draft.customer)?.name || (draft.customer ? 'Customer unavailable' : 'Customer not selected');
    const filtered = drafts.filter(draft => `${draft.title} ${customerName(draft)}`.toLowerCase().includes(query.trim().toLowerCase()));
    const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
    const mutate = async (draft, action) => {
        if (busy) return;
        setConfirm({ isOpen: false }); setBusy(true); setError(''); setMessage('');
        try {
            if (action === 'duplicate') await localData.duplicateInvoiceDraft(draft._id, draft.revision);
            else await localData.removeInvoiceDraft(draft._id, draft.revision);
            if (!mounted.current) return;
            setMessage(action === 'duplicate' ? 'Draft duplicated. Review its new invoice date and set a due date.' : 'Draft removed. Issued invoices are unchanged.');
            setReload(value => value + 1);
        } catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    return <section className='finance-panel draft-desk' aria-labelledby='draft-desk-title'>
        <header className='draft-desk-heading'><div className='draft-desk-identity'><span className='draft-desk-icon'><DescriptionOutlinedIcon /></span><div><span className='workspace-kicker'>PREPARATION DESK</span><h2 id='draft-desk-title'>Saved drafts <span className='draft-count'>{loading ? '…' : drafts.length}</span></h2><p>Save now. Finish later. Nothing is invoiced until you issue.</p></div></div>
            {!!drafts.length && <TextField id='draft-search' label='Find a draft or customer' variant='outlined' size='small' value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />}</header>
        {loading && <p role='status'>Opening saved drafts…</p>}
        {loadError && <div role='alert' className='draft-error'>{loadError} <Button onClick={() => setReload(value => value + 1)}>Try again</Button></div>}
        {error && <div role='alert' className='draft-error'>{error} <Button disabled={busy} onClick={() => setReload(value => value + 1)}>Reload drafts</Button></div>}
        {message && <p role='status' className='draft-message'>{message}</p>}
        {!loading && !loadError && <>{filtered.length ? <div className='draft-card-grid'>{filtered.slice(currentPage * 6, currentPage * 6 + 6).map(draft => <article className='draft-card' key={draft._id}>
            <div className='draft-card-top'><span className='draft-state'>DRAFT · NOT ISSUED</span><span>r{draft.revision}</span></div><h3>{draft.title}</h3><p>{customerName(draft)}</p>
            <div className='draft-card-summary'><strong>{draftAmount(draft)}</strong><span>{draft.lineItems.length} line {draft.lineItems.length === 1 ? 'item' : 'items'}</span></div><small>Saved {savedTime(draft.updatedAt)}</small>
            <footer><Button size='small' color='primary' variant='outlined' disabled={busy} aria-label={'Resume ' + draft.title} onClick={() => onResume(draft)}>Resume draft</Button><div>
                <Tooltip title='Duplicate draft'><span><IconButton size='small' disabled={busy} aria-label={'Duplicate ' + draft.title} onClick={() => mutate(draft, 'duplicate')}><FileCopyOutlinedIcon fontSize='small' /></IconButton></span></Tooltip>
                <Tooltip title='Delete draft'><span><IconButton size='small' disabled={busy} aria-label={'Delete draft ' + draft.title} onClick={() => setConfirm({ isOpen: true, title: 'Delete this draft?', subTitle: `Remove “${draft.title}” from this workspace? No issued invoice will be deleted.`, onConfirm: () => mutate(draft, 'delete') })}><DeleteOutlineRoundedIcon fontSize='small' /></IconButton></span></Tooltip>
            </div></footer></article>)}</div> : <div className='draft-empty'><strong>{drafts.length ? 'No drafts match your search.' : 'A place for orders still taking shape.'}</strong><p>{drafts.length ? 'Try another reference or customer name.' : 'Open Create invoice and choose Save draft—even before all details are ready.'}</p></div>}
            {filtered.length > 6 && <div className='draft-pagination'><span>{currentPage * 6 + 1}–{Math.min((currentPage + 1) * 6, filtered.length)} of {filtered.length} drafts</span><Button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous drafts</Button><Button disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next drafts</Button></div>}
        </>}
        <p className='draft-footnote'>Draft amounts are saved previews, not receivables. Current catalog prices are reviewed on resume. No stock movements are recorded.</p>
        <ConfirmAction confirmDialog={confirm} setConfirmDialog={setConfirm} />
    </section>;
}
