import React, { useState } from 'react';
import { Button, TextField, MenuItem } from '@material-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { recordPayment, correctInvoice } from '../../../Redux/Actions/billAction';
import { money as formatMoney, paymentSummary, states, today } from '../../../utils/indiaBilling';

// Retain the screen preview format; PDF downloads embed a rupee-capable font.
const money = value => formatMoney(value).replace('₹', 'INR ');

export default function InvoiceDocument({ bill }) {
    const products = useSelector(state => state.products);
    const customers = useSelector(state => state.customers);
    const dispatch = useDispatch();
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfError, setPdfError] = useState('');
    const download = async (credit = false) => {
        if (pdfBusy) return;
        setPdfBusy(true); setPdfError('');
        try { const { downloadInvoicePdf } = await import('../../../utils/pdfDocuments'); await downloadInvoicePdf({ bill, customer, products, credit }); }
        catch (error) { setPdfError(error.message || 'PDF download failed. Please try again.'); }
        finally { setPdfBusy(false); }
    };
    const [correction, setCorrection] = useState({ action: 'cancel', reason: '', paymentId: '' });
    const [correctionOpen, setCorrectionOpen] = useState(false);
    const [payment, setPayment] = useState({ amount: '', date: today(), method: 'UPI', reference: '' });
    const [busy, setBusy] = useState(false);
    const customer = bill.customerSnapshot || customers.find(c => c._id === bill.customer) || {};
    const supplier = bill.supplierSnapshot || {};
    const summary = paymentSummary(bill);
    const submit = async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        await dispatch(recordPayment(bill._id, payment, () => setPayment({ ...payment, amount: '', reference: '' })));
        setBusy(false);
    };
    const applyCorrection = async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        const success = await dispatch(correctInvoice(bill._id, correction));
        if (success) { setCorrectionOpen(false); setCorrection({ action: 'cancel', reason: '', paymentId: '' }); }
        setBusy(false);
    };
    return <div className='invoice-document'>
        {pdfError && <p role='alert'>{pdfError}</p>}
        <div className='invoice-toolbar'><span className={'payment-badge status-' + summary.status.toLowerCase().replace(' ', '-')}>{summary.status}</span>
            <Button color='primary' variant='contained' disabled={pdfBusy} onClick={() => download()}>Download PDF</Button></div>
            <article className='invoice-paper'>
                <div className='invoice-header'>{supplier.logo && <img className='business-logo' src={supplier.logo} alt='Business logo' />}<div className='eyebrow'>BILLFLOW</div><h2>{bill.gst ? 'Tax invoice' : 'Invoice'}</h2>
                    <strong>{bill.invoiceNumber || 'Legacy invoice'}</strong>{bill.cancellation && <p className='correction-notice'>CANCELLED · {bill.cancellation.date}<br />{bill.cancellation.reason}</p>}{bill.creditNote && <p className='correction-notice'>Fully credited by {bill.creditNote.number}</p>}<p>Issued {bill.date?.slice(0, 10)}{bill.dueDate && ' · Due ' + bill.dueDate}</p></div>
                <div className='invoice-parties'><section><h4>From</h4><strong>{supplier.name || 'Business details not recorded'}</strong><p>{supplier.address}</p>
                    {supplier.gstin && <p>GSTIN: {supplier.gstin}<br />{bill.supplierState} · {states[bill.supplierState]}</p>}</section>
                    <section><h4>Bill to / deliver to</h4><strong>{customer.name || 'Customer unavailable'}</strong><p>{customer.address}</p><p>{customer.email}<br />{customer.mobile}</p>
                        {customer.gstin && <p>GSTIN: {customer.gstin}</p>}</section></div>
                {bill.gst && <p>Place of supply: {bill.placeOfSupply} · {states[bill.placeOfSupply]}<br />Reverse charge: No</p>}
                {bill.sourceQuotationNumber && <p className='studio-hint'>Converted from quotation {bill.sourceQuotationNumber}</p>}
                {!bill.invoiceNumber && <p className='studio-hint'>Legacy record: customer and product names were not saved at issue time.</p>}
                <table className='invoice-lines'><thead><tr><th>Description</th><th>Qty / unit</th><th>Rate</th><th>Disc.</th>{bill.gst && <><th>GST</th><th>Taxable</th></>}<th>Amount</th></tr></thead>
                    <tbody>{bill.lineItems.map(item => <tr key={item._id}><td>{item.name || products.find(p => p._id === item.product)?.name || 'Unavailable'}{item.hsn && <small>HSN/SAC {item.hsn}</small>}</td>
                        <td>{item.quantity} {item.unit}</td><td>{money(item.price)}</td><td>{item.discount || 0}%</td>
                        {bill.gst && <><td>{item.gstRate}%<small>{bill.interstate ? 'IGST ' + money(item.igst) : 'CGST ' + money(item.cgst) + ' / ' + bill.localTax + ' ' + money(item.stateTax)}</small></td><td>{money(item.taxable)}</td></>}
                        <td>{money(item.subTotal)}</td></tr>)}</tbody></table>
                <div className='studio-totals'>
                    {bill.invoiceNumber && <><div><span>Subtotal</span><span>{money(bill.gross)}</span></div><div><span>Discount</span><span>-{money(bill.discountAmount)}</span></div><div><span>Taxable value</span><span>{money(bill.taxable)}</span></div></>}
                    {bill.gst && (bill.interstate ? <div><span>IGST</span><span>{money(bill.igst)}</span></div> : <><div><span>CGST</span><span>{money(bill.cgst)}</span></div><div><span>{bill.localTax}</span><span>{money(bill.stateTax)}</span></div></>)}
                    <div className='studio-grand-total'><strong>Invoice total</strong><strong>{money(bill.total)}</strong></div>
                    <div><span>Recorded payments</span><span>{money(summary.paid)}</span></div><div><strong>Balance due</strong><strong>{money(summary.balance)}</strong></div>
                </div>
                {supplier.bankDetails && <section className='invoice-notes'><h4>Payment instructions</h4>{supplier.bankDetails}</section>}
                {bill.notes && <p className='invoice-notes'>{bill.notes}</p>}
                {bill.gst && <div className='invoice-signature'>For {supplier.name}<br /><br /><br />Authorised signatory</div>}
            </article>

        {bill.creditNote && <section className='payment-panel'><Button disabled={pdfBusy} onClick={() => download(true)} color='primary'>Download credit note PDF</Button>
                <article className='invoice-paper'><h2>Credit note</h2><strong>{bill.creditNote.number}</strong><p>Date: {bill.creditNote.date}</p>
                    <p>Original invoice: {bill.invoiceNumber} · {bill.date.slice(0, 10)}</p>
                    <p><strong>{supplier.name}</strong><br />{supplier.address}<br />GSTIN: {supplier.gstin || 'Not applicable'}</p>
                    <p><strong>{customer.name}</strong><br />{customer.address}<br />GSTIN: {customer.gstin || 'Unregistered'}</p>
                    <p>Full invoice credit · {bill.creditNote.reason}</p>
                    {bill.gst && <p>Place of supply: {bill.placeOfSupply} · {states[bill.placeOfSupply]}</p>}
                    <table className='invoice-lines'><thead><tr><th>Item / HSN</th><th>Quantity</th><th>Taxable</th><th>CGST</th><th>{bill.localTax || 'SGST'}</th><th>IGST</th><th>Total</th></tr></thead>
                    <tbody>{bill.lineItems.map(item => <tr key={item._id}><td>{item.name}<small>{item.hsn}{bill.gst && ' · GST ' + item.gstRate + '%'}</small></td><td>{item.quantity} {item.unit}</td><td>{money(item.taxable)}</td><td>{money(item.cgst)}</td><td>{money(item.stateTax)}</td><td>{money(item.igst)}</td><td>{money(item.subTotal)}</td></tr>)}</tbody></table>
                    <div className='studio-totals'><div><span>Taxable credit</span><strong>{money(bill.creditNote.taxable)}</strong></div><div className='studio-grand-total'><span>Total credit</span><strong>{money(bill.creditNote.amount)}</strong></div></div>
                    <p>Recorded by {bill.creditNote.actor}. This document does not submit a GST return or process a refund.</p>
                    <div className='invoice-signature'>For {supplier.name}<br /><br /><br />Authorised signatory</div>
                </article>
            </section>}
        <section className='payment-panel'><h3>Payment history</h3><p className='studio-hint'>Record payments received outside BillFlow. This does not collect or verify bank payments.</p>
            {(bill.payments || []).length ? <ul className='payment-history'>{bill.payments.map(p => <li key={p._id}><strong>{money(p.amount)}</strong><span>{p.date} · {p.method}</span><span>{p.reference || 'No reference'}</span>{(bill.reversals || []).filter(r => r.paymentId === p._id).map(r => <span key={r._id}>Reversed {r.date}: {r.reason}</span>)}</li>)}</ul> : <p>No payments recorded yet.</p>}
            {summary.balance > 0 && <form onSubmit={submit}><fieldset disabled={busy} className='studio-fields'><div className='studio-grid'>
                <TextField id='payment-amount' required label='Amount received (₹)' type='number' variant='outlined' size='small' value={payment.amount} inputProps={{ min: 0.01, max: summary.balance, step: 0.01 }} onChange={e => setPayment({ ...payment, amount: e.target.value })} />
                <TextField id='payment-date' required label='Payment date' type='date' variant='outlined' size='small' InputLabelProps={{ shrink: true }} value={payment.date} inputProps={{ min: bill.date?.slice(0, 10), max: today() }} onChange={e => setPayment({ ...payment, date: e.target.value })} />
                <TextField id='payment-method' select label='Method' variant='outlined' size='small' value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })}>{['UPI', 'Bank transfer', 'Cash', 'Card', 'Cheque'].map(method => <MenuItem key={method} value={method}>{method}</MenuItem>)}</TextField>
                <TextField id='payment-reference' label='Transaction reference' variant='outlined' size='small' value={payment.reference} inputProps={{ maxLength: 120 }} onChange={e => setPayment({ ...payment, reference: e.target.value })} />
            </div><Button type='submit' color='primary' variant='outlined' disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</Button></fieldset></form>}
        </section>
        <section className='payment-panel'><h3>Corrections and history</h3>
            <p className='studio-hint'>Corrections retain the original record. Cancellation and full credit require no active payments. Payment reversal corrects a record only; it does not send a refund. GST reporting and cancellation eligibility must be checked separately.</p>
            {bill.cancellation && <p>Cancelled {bill.cancellation.date} by {bill.cancellation.actor}: {bill.cancellation.reason}</p>}
            {bill.creditNote && <p>Credited {bill.creditNote.date} by {bill.creditNote.actor}: {bill.creditNote.reason}</p>}
            <Button disabled={busy} onClick={() => setCorrectionOpen(!correctionOpen)}>{correctionOpen ? 'Close correction' : 'Record a correction'}</Button>
            {correctionOpen && <form onSubmit={applyCorrection}><fieldset disabled={busy} className='studio-fields'><div className='studio-grid'>
                <TextField id='correction-action' select label='Correction type' variant='outlined' value={correction.action} onChange={e => setCorrection({ ...correction, action: e.target.value })}>
                    <MenuItem value='cancel'>Cancel invoice</MenuItem><MenuItem value='credit'>Full invoice credit note</MenuItem><MenuItem value='reverse'>Reverse payment record</MenuItem>
                </TextField>
                {correction.action === 'reverse' && <TextField id='correction-payment' select required label='Payment to reverse' variant='outlined' value={correction.paymentId} onChange={e => setCorrection({ ...correction, paymentId: e.target.value })}>
                    {(bill.payments || []).filter(p => !(bill.reversals || []).some(r => r.paymentId === p._id)).map(p => <MenuItem key={p._id} value={p._id}>{p.date} · {money(p.amount)} · {p.method}</MenuItem>)}
                </TextField>}
                <TextField id='correction-reason' required multiline variant='outlined' label='Reason for correction' value={correction.reason} inputProps={{ maxLength: 500 }} onChange={e => setCorrection({ ...correction, reason: e.target.value })} />
            </div><Button type='submit' color='secondary' variant='outlined' disabled={busy}>{busy ? 'Saving…' : 'Confirm correction'}</Button></fieldset></form>}
        </section>
    </div>;
}
