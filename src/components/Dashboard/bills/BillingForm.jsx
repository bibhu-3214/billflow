import React, { useEffect, useRef, useState } from 'react';
import { Button, TextField, MenuItem, Switch, FormControlLabel } from '@material-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { addBill } from '../../../Redux/Actions/billAction';
import { calculateInvoice, money, states, today, validDate } from '../../../utils/indiaBilling';
import localData from '../../../data/localData';
import { usePopupForm } from '../../Popup';

export default function BillingForm({ setOpenPopup, initialDraft, onDraftSaved, quotationMode = false, onQuotationSaved, onTemplateSaved }) {
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [dirty, setDirty] = useState(false);
    const customers = useSelector(state => state.customers);
    const products = useSelector(state => state.products);
    const dispatch = useDispatch();
    const history = useHistory();
    const [values, setValues] = useState(() => initialDraft ? { ...initialDraft,
        customer: customers.some(customer => customer._id === initialDraft.customer) ? initialDraft.customer : '' } : {
        customer: '', date: today(), dueDate: today(), gst: false,
        supplierGSTIN: '', customerGSTIN: '', supplierState: '', placeOfSupply: '', billingAddress: '', notes: '' });
    const [draftTitle, setDraftTitle] = useState(initialDraft?.title || '');
    const [items, setItems] = useState(() => (initialDraft?.lineItems || []).map(item => {
        const product = products.find(record => record._id === item.product);
        return product ? { ...item, name: product.name, price: product.price } : item;
    }));
    const [productId, setProductId] = useState('');
    const [operation, setOperation] = useState('');
    const busy = Boolean(operation);
    const [saveError, setSaveError] = useState('');
    const [templateNotice, setTemplateNotice] = useState('');
    const [defaultsLoaded, setDefaultsLoaded] = useState(false);
    const [defaultsError, setDefaultsError] = useState('');
    useEffect(() => {
        if (initialDraft) { setDefaultsLoaded(true); return; }
        let active = true;
        localData.getSettings().then(settings => {
            if (!active) return;
            const due = new Date(); due.setDate(due.getDate() + (quotationMode ? 15 : Number(settings.dueDays || 0)));
            const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
            setValues(current => ({ ...current, dueDate, supplierGSTIN: settings.gstin, supplierState: settings.state,
                gst: Boolean(settings.gstin), notes: settings.terms }));
            setDefaultsLoaded(true);
        }).catch(error => { if (active) setDefaultsError(error.message); });
        return () => { active = false; };
    }, [initialDraft, quotationMode]);
    const catalogChanged = initialDraft?.lineItems.some(item => {
        const product = products.find(record => record._id === item.product);
        return product && Number(product.price) !== Number(item.price);
    });
    const missingProducts = items.some(item => !products.some(product => product._id === item.product));
    const missingCustomer = initialDraft?.customer && !customers.some(customer => customer._id === initialDraft.customer);
    const dueAfter = days => {
        if (!validDate(values.date)) return '';
        const date = new Date(values.date + 'T00:00:00Z');
        date.setUTCDate(date.getUTCDate() + days);
        const result = date.toISOString().slice(0, 10);
        return validDate(result) ? result : '';
    };
    const field = (name, label, props = {}) => <TextField id={'invoice-' + name} variant='outlined' size='small' fullWidth name={name} label={label}
        value={values[name]} onChange={e => { setDirty(true); setValues({ ...values, [name]: e.target.value }); }} {...props} />;
    const itemChange = (index, key, value) => { setDirty(true); setItems(items.map((item, i) => i === index ? { ...item, [key]: value } : item)); };
    let totals, error;
    try { totals = calculateInvoice(items, values); } catch (problem) { error = problem.message; }
    const addProduct = () => {
        const product = products.find(record => record._id === productId);
        if (!product) return;
        setDirty(true);
        setItems([...items, { product: product._id, name: product.name, price: product.price, quantity: 1, discount: 0, gstRate: product.gstRate ?? '', hsn: product.hsn || '', unit: product.unit || 'NOS' }]);
        setProductId('');
    };
    const submit = async event => {
        event.preventDefault();
        if (busy || error) return;
        setOperation('issue'); setSaveError('');
        try {
            if (quotationMode) {
                const quote = await localData.saveQuotation({ ...values, title: draftTitle || 'Retail quotation', lineItems: items });
                if (mounted.current) { onQuotationSaved?.(quote); setOpenPopup(false); }
                return;
            }
            const result = await dispatch(addBill({ ...values, lineItems: items,
                ...(initialDraft ? { draftId: initialDraft._id, draftRevision: initialDraft.revision } : {}) }, id => {
                if (!mounted.current) return;
                setOpenPopup(false);
                history.push('/billdetails/' + id);
            }));
            if (mounted.current && !result?.ok) setSaveError(result?.error || 'Could not issue the invoice. Your entries are still here.');
        } catch (problem) { if (mounted.current) setSaveError(problem.message || 'Could not issue this invoice.'); }
        finally { if (mounted.current) setOperation(''); }
    };
    const saveDraft = async () => {
        if (busy) return;
        setOperation('save'); setSaveError('');
        try {
            const draft = await localData.saveInvoiceDraft({ ...values, title: draftTitle, lineItems: items }, initialDraft?._id, initialDraft?.revision);
            if (!mounted.current) return;
            setDirty(false);
            onDraftSaved?.(draft);
            setOpenPopup(false);
        } catch (problem) { if (mounted.current) setSaveError(problem.message || 'Could not save. Your entries are still here.'); }
        finally { if (mounted.current) setOperation(''); }
    };
    const saveTemplate = async () => {
        if (busy) return;
        setOperation('template'); setSaveError('');
        try {
            if (!draftTitle.trim()) throw new Error('Enter an internal reference to name your reusable template.');
            await localData.saveInvoiceTemplate({ title: draftTitle, lineItems: items, notes: values.notes });
            if (mounted.current) { onTemplateSaved?.(); setTemplateNotice('Item template saved. Customer, dates and invoice identifiers were not copied.'); }
        } catch (problem) { if (mounted.current) setSaveError(problem.message); }
        finally { if (mounted.current) setOperation(''); }
    };
    const requestClose = usePopupForm(dirty, busy);
    return <form className='invoice-studio' onChange={() => setDirty(true)} onSubmit={submit}>
        <div className='invoice-studio-intro'><span className='editor-tag'>{quotationMode ? 'SALES / QUOTATION' : initialDraft ? 'RESUME DRAFT · REVISION ' + initialDraft.revision : 'NEW INVOICE'}</span><h2>{quotationMode ? 'Prepare your quotation' : 'Prepare your invoice'}</h2><p>{quotationMode ? 'Lock a clear offer. Record acceptance manually, then convert once to an invoice.' : 'Save unfinished work as a draft, or review and issue when ready.'}</p></div>
        {templateNotice && <p role='status' className='draft-message'>{templateNotice}</p>}
        {!defaultsLoaded && <p className='editor-error' role='status'>{defaultsError || 'Loading business defaults…'}</p>}
        {saveError && <div className='editor-error' role='alert'>{saveError}</div>}
        {(catalogChanged || missingProducts || missingCustomer) && <div className='draft-review-warning' role='status'>
            {catalogChanged && <p>Catalog prices changed since this draft was saved. The preview now uses current prices; review them before issuing.</p>}
            {missingProducts && <p>A product was removed from the catalog. Remove or replace the unavailable item before saving or issuing.</p>}
            {missingCustomer && <p>The original customer is unavailable. Choose a customer before issuing.</p>}
        </div>}
        <div className='invoice-composer-layout'><div className='invoice-composer-sections'>
        <fieldset disabled={busy || !defaultsLoaded} className='studio-fields'>
            <section className='composer-section'><header><span className='editor-step'>01</span><div><h3>Customer &amp; schedule</h3><p>{quotationMode ? 'Who the offer is for, and how long it remains valid.' : 'Who you are billing, and when payment is due.'}</p></div></header>
            <TextField className='draft-title-field' id='invoice-draft-title' label={quotationMode ? 'Offer title' : 'Draft reference (internal only)'} size='small' variant='outlined' fullWidth value={draftTitle} inputProps={{ maxLength: 80 }} helperText={quotationMode ? 'A clear reference printed on this quotation.' : 'For example: Counter order · Patel Traders. Not printed on invoices.'} onChange={event => { setDirty(true); setDraftTitle(event.target.value); }} />
            <div className='studio-grid'>
                {field('customer', 'Customer', { select: true, required: true, onChange: e => {
                    setDirty(true);
                    const customer = customers.find(c => c._id === e.target.value);
                    setValues(current => ({ ...current, customer: e.target.value, billingAddress: customer?.address || '', customerGSTIN: customer?.gstin || '', placeOfSupply: customer?.state || '' }));
                }, children: customers.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>) })}
                {field('date', quotationMode ? 'Quotation date' : 'Invoice date', { type: 'date', required: true, InputLabelProps: { shrink: true } })}
                {field('dueDate', quotationMode ? 'Valid until' : 'Due date', { type: 'date', required: true, InputLabelProps: { shrink: true }, inputProps: { min: values.date } })}
                {field('billingAddress', 'Customer billing / delivery address', { required: true, multiline: true, inputProps: { maxLength: 500 } })}
            </div>
            <div className='payment-term-shortcuts' role='group' aria-label={quotationMode ? 'Quick validity periods' : 'Quick payment terms'}><span>{quotationMode ? 'Offer validity' : 'Payment terms'}</span>{[0, 7, 15, 30].map(days => <Button type='button' key={days} size='small' disabled={busy || !dueAfter(days)} aria-pressed={values.dueDate === dueAfter(days)} onClick={() => { setDirty(true); setValues(current => ({ ...current, dueDate: dueAfter(days) })); }}>{days ? quotationMode ? `${days} days` : `Net ${days}` : quotationMode ? 'Today only' : 'Due today'}</Button>)}</div>
            </section>
            <section className='composer-section'><header><span className='editor-step'>02</span><div><h3>Tax treatment</h3><p>Confirm the applicable domestic GST details.</p></div></header>
            <FormControlLabel control={<Switch color='primary' checked={values.gst} onChange={e => { setDirty(true); setValues({ ...values, gst: e.target.checked }); }} />} label='GST-registered supplier — domestic taxable supply' />
            {values.gst && <><div className='studio-grid'>
                {field('supplierGSTIN', 'Supplier GSTIN', { required: true, inputProps: { maxLength: 15 } })}
                {field('customerGSTIN', 'Customer GSTIN (optional)', { inputProps: { maxLength: 15 } })}
                {['supplierState', 'placeOfSupply'].map(name => <React.Fragment key={name}>{field(name, name === 'supplierState' ? 'Supplier state' : 'Place of supply', {
                    select: true, required: true, children: Object.entries(states).sort((a, b) => a[1].localeCompare(b[1])).map(([code, label]) => <MenuItem key={code} value={code}>{code} · {label}</MenuItem>),
                })}</React.Fragment>)}
            </div><p className='studio-hint'>Prices exclude GST. Confirm each item's rate and HSN/SAC. Exports, SEZ, reverse charge, exempt supplies, composition schemes and cess are not supported in this GST workflow.</p></>}
            {!values.gst && <p className='studio-hint'>GST is not being calculated for this {quotationMode ? 'quotation' : 'invoice'}.</p>}
            </section>
            <section className='composer-section'><header><span className='editor-step'>03</span><div><h3>Line items</h3><p>Use catalog defaults, then adjust quantities and discounts.</p></div></header>
            <div className='studio-product-picker'><TextField id='invoice-product' select fullWidth variant='outlined' size='small' label='Product' value={productId} onChange={e => { setDirty(true); setProductId(e.target.value); }}>
                {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name} · {money(p.price)}</MenuItem>)}
            </TextField><Button variant='outlined' color='primary' disabled={!productId || items.length >= 100} onClick={addProduct}>Add</Button></div>
            {items.map((item, index) => <section className='studio-item' key={index}>
                <div className='studio-item-title'><strong>{item.name}{!products.some(product => product._id === item.product) && ' · Unavailable'}</strong><span>{money(item.price)} / unit</span><Button size='small' color='secondary' onClick={() => { setDirty(true); setItems(items.filter((_, i) => i !== index)); }}>Remove</Button></div>
                <div className='studio-grid'>
                    {[['quantity', 'Quantity', 1, 10000], ['discount', 'Discount %', 0, 100], ...(values.gst ? [['gstRate', 'GST %', 0, 40]] : [])].map(([key, label, min, max]) =>
                        <TextField id={'item-' + index + '-' + key} key={key} label={label} type='number' size='small' variant='outlined' required value={item[key]} inputProps={{ min, max, step: key === 'quantity' ? 1 : 0.01 }} onChange={e => itemChange(index, key, e.target.value)} />)}
                    <TextField id={'item-unit-' + index} label='Unit (e.g. NOS, HRS)' size='small' variant='outlined' required value={item.unit} inputProps={{ maxLength: 12 }} onChange={e => itemChange(index, 'unit', e.target.value)} />
                    {values.gst && <TextField id={'item-hsn-' + index} label='HSN / SAC' size='small' variant='outlined' required value={item.hsn} inputProps={{ pattern: '[0-9]{4,8}', maxLength: 8 }} onChange={e => itemChange(index, 'hsn', e.target.value)} />}
                </div>
            </section>)}
            {!items.length && <div className='composer-empty'><strong>{quotationMode ? 'Your offer starts with an item.' : 'Your invoice starts with an item.'}</strong><p>Select a catalog product above to add its price and defaults.</p></div>}
            </section>
            <section className='composer-section'><header><span className='editor-step'>04</span><div><h3>Payment terms</h3><p>Give your customer a clear next step.</p></div></header>
            {field('notes', 'Notes / payment terms', { multiline: true, rows: 2, inputProps: { maxLength: 1000 } })}
            {!quotationMode && <div className='template-save-action'><p className='studio-hint'>Reuse this item bundle and notes without copying customer details or dates. Name it with the internal reference above.</p><Button type='button' variant='outlined' disabled={busy || !items.length || missingProducts} onClick={saveTemplate}>Save item template</Button></div>}
            </section>
        </fieldset></div>
        <aside className='invoice-review' aria-label={quotationMode ? 'Quotation totals' : 'Invoice review'}><span className='dialog-eyebrow'>LIVE REVIEW</span><h3>{quotationMode ? 'Offer summary' : 'Invoice summary'}</h3><p className='invoice-review-customer'>{customers.find(customer => customer._id === values.customer)?.name || 'Select a customer'}</p><div className='invoice-review-meta'><span>{items.length} line {items.length === 1 ? 'item' : 'items'}</span><span>INR · {values.gst ? 'GST enabled' : 'No GST'}</span></div>
            {totals ? <div className='studio-totals'>
                <div><span>Subtotal</span><strong>{money(totals.gross)}</strong></div>
                <div><span>Discount</span><strong>−{money(totals.discountAmount)}</strong></div>
                <div><span>Taxable value</span><strong>{money(totals.taxable)}</strong></div>
                {values.gst && (totals.interstate ? <div><span>IGST</span><strong>{money(totals.igst)}</strong></div> : <><div><span>CGST</span><strong>{money(totals.cgst)}</strong></div><div><span>{totals.localTax}</span><strong>{money(totals.stateTax)}</strong></div></>)}
                <div className='studio-grand-total'><span>{quotationMode ? 'Quoted total' : 'Invoice total'}</span><strong>{money(totals.total)}</strong></div>
            </div> : <div className='invoice-review-pending'><strong>{money(0)}</strong><p role='status'>{error}</p></div>}
            <div className='invoice-review-notice'><strong>{quotationMode ? 'An offer, not a sale' : 'Fixed at issue'}</strong><p>{quotationMode ? 'Saving locks prices and party details. Acceptance is a manual record, not online customer approval. No revenue or stock movement is created.' : 'Customer, business and product details are saved as a snapshot. Payments are recorded separately.'}</p></div>
        </aside></div>
        <footer className='editor-footer'><span aria-live='polite'>{busy ? 'Saving…' : dirty ? 'Unsaved changes' : 'Ready to prepare'}</span><div><Button disabled={busy} onClick={() => requestClose ? requestClose() : setOpenPopup(false)}>Cancel</Button>{!quotationMode && <Button variant='outlined' color='primary' type='button' disabled={busy || !defaultsLoaded || missingProducts} onClick={saveDraft}>{operation === 'save' ? 'Saving…' : 'Save draft'}</Button>}<Button variant='contained' color='primary' type='submit' disabled={busy || !defaultsLoaded || !totals || !values.customer || missingProducts}>{operation === 'issue' ? 'Saving…' : quotationMode ? 'Save quotation' : 'Issue invoice'}</Button></div></footer>
    </form>;
}
