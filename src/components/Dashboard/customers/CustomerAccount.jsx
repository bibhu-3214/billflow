import React from 'react';
import { useSelector } from 'react-redux';
import { Button } from '@material-ui/core';
import { Link } from 'react-router-dom';
import { money } from '../../../utils/indiaBilling';
import { customerAccounts } from '../../../utils/receivables';
import FollowUpDesk from '../FollowUpDesk';

export default function CustomerAccount({ customer }) {
    const { bills } = useSelector(state => state.bills);
    const account = customerAccounts([customer], bills)[0];
    const invoices = bills.filter(bill => bill.customer === customer._id).sort((a, b) => b.date.localeCompare(a.date));
    return <div className='customer-account'><div className='account-heading'><span className='account-monogram'>{customer.name.charAt(0)}</span><div><h2>{customer.name}</h2><p>{customer.email} · {customer.mobile}</p></div></div>
        <div className='finance-metrics'>{[['Lifetime invoiced', account.invoiced], ['Outstanding', account.outstanding], ['Overdue', account.overdue]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{money(value)}</strong></article>)}</div>
        <div className='account-profile-grid'><section><h3>Billing profile</h3><p>{customer.company || customer.name}</p><p>{customer.address || 'No default billing address'}</p><p>{customer.gstin ? 'GSTIN: ' + customer.gstin : 'No GSTIN recorded'}</p></section><section><h3>Relationship context</h3><p>{customer.contactPerson ? 'Contact: ' + customer.contactPerson : 'No primary contact specified'}</p><p className='preserve-lines'>{customer.notes || 'No internal notes yet.'}</p></section></div>
        <FollowUpDesk customerId={customer._id} />
        <div className='finance-section-title'><h3>Invoice history</h3><Button component={Link} to={'/statements?customer=' + encodeURIComponent(customer._id)}>Account statement</Button></div>
        <div className='account-history'>{invoices.map(bill => <Link to={'/billdetails/' + bill._id} key={bill._id}><div><strong>{bill.invoiceNumber || 'Legacy invoice'}</strong><span>{bill.date.slice(0, 10)}{bill.cancellation ? ' · Cancelled' : bill.creditNote ? ' · Credited' : ''}</span></div><strong>{money(bill.total)}</strong><span aria-hidden='true'>→</span></Link>)}</div>
        {!invoices.length && <div className='finance-empty'><h3>No invoices yet</h3><p>This customer's billing history will appear here.</p></div>}
    </div>;
}
