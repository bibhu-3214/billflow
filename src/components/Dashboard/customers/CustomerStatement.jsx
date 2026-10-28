import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { TextField, MenuItem, Button } from '@material-ui/core';
import localData from '../../../data/localData';
import { money as formatMoney, today } from '../../../utils/indiaBilling';
import { statementRows } from '../../../utils/statements';
import { useLocation } from 'react-router-dom';

const money = value => formatMoney(value).replace('₹', 'INR ');

export default function CustomerStatement() {
    const customers = useSelector(state => state.customers);
    const { bills } = useSelector(state => state.bills);
    const location = useLocation();
    const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('customer') || '');
    useEffect(() => { setSelected(new URLSearchParams(location.search).get('customer') || ''); }, [location.search]);
    const [business, setBusiness] = useState(null);
    const [error, setError] = useState('');
    const [pdfBusy, setPdfBusy] = useState(false);
    const download = async () => {
        if (pdfBusy || !customer || !business) return;
        setPdfBusy(true); setError('');
        try { const { downloadStatementPdf } = await import('../../../utils/pdfDocuments'); await downloadStatementPdf({ bills, customer, business }); }
        catch (error) { setError(error.message || 'PDF download failed. Please try again.'); }
        finally { setPdfBusy(false); }
    };
    useEffect(() => { localData.getSettings().then(setBusiness).catch(e => setError(e.message)); }, []);
    const rows = statementRows(bills, selected);
    const customer = customers.find(c => c._id === selected);
    return <section className='workspace-page page-enter statement-workspace'><div className='workspace-heading'><div><span className='workspace-kicker'>CUSTOMERS / ACCOUNT LEDGER</span><h1>Customer statements</h1><p>Invoices, payments and corrections in one chronological account.</p></div></div>
        <div className='invoice-toolbar'><TextField className='statement-customer-picker' id='statement-customer' label='Customer' select variant='outlined' value={selected} onChange={e => setSelected(e.target.value)}>{customers.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}</TextField>
            <Button variant='contained' color='primary' disabled={pdfBusy || !customer || !business} onClick={download}>Download statement PDF</Button></div>
        {error && <p role='alert'>{error}</p>}
        {customer && business ? <>
            <article className='invoice-paper'><h2>Statement of account</h2><strong>{business.name}</strong><p>{business.address}</p><h3>{customer.name}</h3><p>{customer.email} · {customer.mobile}</p><p>All recorded activity · Generated {today()}</p>
                <table className='invoice-lines'><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row.date}</td><td>{row.reference}</td><td>{row.description}</td><td>{money(row.debit)}</td><td>{money(row.credit)}</td><td>{money(row.balance)}</td></tr>)}</tbody></table>
                {!rows.length && <p>No transactions recorded.</p>}<div className='studio-totals'><div className='studio-grand-total'><span>Closing balance</span><strong>{money(rows.length ? rows[rows.length - 1].balance : 0)}</strong></div></div>
                <p>Based on records in this workspace. Payment entries are recorded manually.</p>
            </article>
        </> : <p>Select a customer to view their statement.</p>}
    </section>;
}
