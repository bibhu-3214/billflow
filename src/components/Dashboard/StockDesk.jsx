import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField, MenuItem } from '@material-ui/core';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import localData from '../../data/localData';
import Popup, { usePopupForm } from '../Popup';

export function StockEditor({ product, record, onClose, onSaved }) {
    const [type, setType] = useState(record ? 'adjustment' : 'opening');
    const [delta, setDelta] = useState('');
    const [reorderLevel, setReorderLevel] = useState(String(record?.reorderLevel || 0));
    const [reason, setReason] = useState('');
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const close = usePopupForm(dirty, busy);
    const preview = (record?.onHand || 0) + Number(delta || 0);
    const save = async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError('');
        try {
            await localData.recordStockMovement({ product: product._id, revision: record?.revision || 0, type, delta, reorderLevel, reason });
            if (mounted.current) { onSaved(); onClose(); }
        } catch (problem) { if (mounted.current) setError(problem.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    return <form className='operations-editor' onSubmit={save} onChange={() => setDirty(true)}><span className='workspace-kicker'>MANUAL STOCK CONTROL</span><h2>{product.name}</h2><p>{record ? 'Record a counted change. Previous movements are retained.' : 'Start with a physical count, not an inferred balance from old invoices.'}</p>
        {error && <p role='alert' className='editor-error'>{error}</p>}
        <div className='operations-preview'><span>{record ? `${record.onHand} ${record.unit} currently tracked` : 'Stock is unknown until the opening count is saved'}</span><strong>{delta !== '' && Number.isFinite(preview) ? preview.toLocaleString('en-IN') : '—'} after this movement</strong></div>
        <fieldset disabled={busy} className='studio-fields'><div className='studio-grid'>
            {record && <TextField id='stock-type' select label='Movement type' variant='outlined' value={type} onChange={event => { setDirty(true); setType(event.target.value); setDelta(event.target.value === 'threshold' ? '0' : ''); }}><MenuItem value='adjustment'>Stock adjustment</MenuItem><MenuItem value='threshold'>Reorder threshold only</MenuItem></TextField>}
            <TextField id='stock-delta' label={record ? 'Change in units (+ / −)' : 'Opening units'} type='number' variant='outlined' required disabled={type === 'threshold'} value={delta} inputProps={{ min: record ? -1000000 : 0, max: 1000000, step: 1 }} helperText={record ? 'Positive for stock received; negative for stock removed.' : 'Whole units only. Zero is a valid counted opening balance.'} onChange={event => setDelta(event.target.value)} />
            <TextField id='stock-reorder' label='Low-stock threshold' type='number' variant='outlined' required value={reorderLevel} inputProps={{ min: 0, max: 1000000, step: 1 }} onChange={event => setReorderLevel(event.target.value)} />
            <TextField className='editor-wide' id='stock-reason' label='Count / adjustment reason' variant='outlined' required multiline rows={2} value={reason} inputProps={{ maxLength: 500 }} onChange={event => setReason(event.target.value)} />
        </div></fieldset><p className='studio-hint'>Invoices, quotations and credits do not change this stock. No automatic unit conversion or stock valuation is performed. Count dates are recorded at save time.</p>
        {!!record?.movements.length && <details className='operations-history'><summary>Movement history ({record.movements.length})</summary>{record.movements.slice().reverse().map((movement, index) => <article key={index}><strong>{movement.type} · {movement.delta > 0 ? '+' : ''}{movement.delta} · Balance {movement.balance}</strong><small>{new Date(movement.at).toLocaleString('en-IN')} · Threshold {movement.reorderLevel ?? 'Not recorded'}</small><p>{movement.reason}</p></article>)}</details>}
        <footer className='editor-footer'><Button disabled={busy} onClick={() => close ? close() : onClose()}>Cancel</Button><Button color='primary' variant='contained' type='submit' disabled={busy}>{busy ? 'Recording…' : 'Record stock movement'}</Button></footer>
    </form>;
}

export default function StockDesk({ compact = false }) {
    const products = useSelector(state => state.products);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('All');
    const [page, setPage] = useState(0);
    const [editing, setEditing] = useState(null);
    useEffect(() => {
        let active = true; setLoading(true); setError('');
        localData.getStockRecords().then(values => { if (active) setRecords(values); }).catch(problem => { if (active) setError(problem.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [reload]);
    const low = records.filter(record => record.onHand <= record.reorderLevel);
    const rows = products.map(product => ({ product, record: records.find(record => record.product === product._id) }));
    const filtered = rows.filter(({ product, record }) => (!compact || record?.onHand <= record?.reorderLevel) && `${product.name} ${product.sku || ''}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'All' || (filter === 'Not tracked' ? !record : record && record.onHand <= record.reorderLevel)));
    const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
    return <section className='finance-panel operations-desk stock-desk' aria-label={compact ? 'Stock attention' : 'Manual stock desk'}><header className='draft-desk-heading'><div><span className='workspace-kicker'>PRODUCT OPERATIONS</span><h2>{compact ? 'Stock needing attention' : 'Manual stock desk'}</h2><p>{records.length} tracked products · {low.length} at or below threshold. Untracked stock is unknown, not zero.</p></div>{compact && <Button component={Link} to='/product'>Open stock desk</Button>}</header>
        {error && <p role='alert' className='editor-error'>{error} <Button onClick={() => setReload(value => value + 1)}>Reload stock</Button></p>}{loading && <p role='status'>Opening stock records…</p>}
        {!compact && <div className='operations-filters'><TextField id='stock-search' label='Find product or SKU' size='small' variant='outlined' value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><TextField id='stock-filter' select label='Stock view' size='small' variant='outlined' value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>{['All', 'Low stock', 'Not tracked'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></div>}
        {!loading && !error && <div className='operations-list'>{filtered.slice(compact ? 0 : currentPage * 6, compact ? 3 : currentPage * 6 + 6).map(({ product, record }) => <article key={product._id}><div><strong>{product.name}</strong><small>{product.sku || 'No SKU'} · {record?.unit || product.unit || 'NOS'}</small></div><div className='operations-balance'><strong>{record ? record.onHand.toLocaleString('en-IN') : 'Unknown'}</strong><small>{record ? `Threshold ${record.reorderLevel}` : 'Opening count needed'}</small></div>{record && record.onHand <= record.reorderLevel && <span className='operations-badge warning'>{record.onHand === 0 ? 'Out of stock' : 'Low stock'}</span>}{!compact && <Button aria-label={`Manage stock ${product.name}`} onClick={() => setEditing({ product, record })}>{record ? 'Adjust / history' : 'Set opening'}</Button>}</article>)}</div>}
        {!loading && !error && !filtered.length && <div className='draft-empty'><strong>{compact ? 'No tracked products need replenishment.' : 'No products match this stock view.'}</strong><p>{compact ? 'Untracked products still need a physical opening count in Products.' : 'Add a catalog product or change the filter.'}</p></div>}
        {!compact && filtered.length > 6 && <div className='draft-pagination'><span>{currentPage * 6 + 1}–{Math.min((currentPage + 1) * 6, filtered.length)} of {filtered.length}</span><Button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous products</Button><Button disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next products</Button></div>}
        <p className='draft-footnote'>Manual counts only—not live sales inventory, procurement or inventory valuation. Stock history prevents product deletion.</p>
        <Popup title={editing?.record ? 'Stock adjustment & history' : 'Opening stock count'} size='operations' openPopup={Boolean(editing)} setOpenPopup={open => { if (!open) { setEditing(null); setReload(value => value + 1); } }}>{editing && <StockEditor key={editing.product._id} {...editing} onSaved={() => setReload(value => value + 1)} onClose={() => setEditing(null)} />}</Popup>
    </section>;
}
