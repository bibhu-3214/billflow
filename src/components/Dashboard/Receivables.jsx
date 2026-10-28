import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, TextField, MenuItem, DialogTitle, DialogContent, DialogActions } from '@material-ui/core';
import WorkspaceDialog from '../WorkspaceDialog';
import ArrowForwardRoundedIcon from '@material-ui/icons/ArrowForwardRounded';
import { agingSummary, receivableRows, reminderText } from '../../utils/receivables';
import { money } from '../../utils/indiaBilling';
import FollowUpDesk from './FollowUpDesk';

export default function Receivables() {
    const { bills } = useSelector(state => state.bills);
    const customers = useSelector(state => state.customers);
    const [bucket, setBucket] = useState('All');
    const [query, setQuery] = useState('');
    const [reminder, setReminder] = useState('');
    const [message, setMessage] = useState('');
    const rows = useMemo(() => receivableRows(bills, customers).filter(row => row.balance > 0), [bills, customers]);
    const aging = agingSummary(rows);
    const shown = rows.filter(row => (bucket === 'All' || row.bucket === bucket) && `${row.customerName} ${row.invoiceNumber || ''}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.overdueDays - a.overdueDays || b.balance - a.balance);
    const outstanding = aging.reduce((sum, group) => sum + group.amount, 0);
    const overdue = rows.filter(row => row.overdueDays > 0).reduce((sum, row) => sum + row.balance, 0);
    const dueSoon = rows.filter(row => row.daysUntilDue !== null && row.daysUntilDue >= 0 && row.daysUntilDue <= 7).reduce((sum, row) => sum + row.balance, 0);
    const copy = async () => {
        try { await navigator.clipboard.writeText(reminder); setMessage('Copied. Review the message and send it through your usual channel.'); }
        catch { setMessage('Clipboard unavailable. Select and copy the message manually.'); }
    };
    return <section className='workspace-page page-enter finance-workspace'>
        <header className='finance-heading'><div><span className='workspace-kicker'>CASH FLOW / COLLECTIONS</span><h1>Turn invoices into cash flow.</h1><p>Your follow-up queue, ordered by age and outstanding balance.</p></div><Button component={Link} to='/billing' variant='contained' color='primary' endIcon={<ArrowForwardRoundedIcon />}>Invoice workspace</Button></header>
        <div className='finance-metrics'>{[['Total receivables', outstanding, `${rows.length} open invoices`], ['Past due', overdue, 'Prioritise these conversations'], ['Due in the next 7 days', dueSoon, 'Includes invoices due today']].map(([label, amount, detail]) => <article key={label}><span>{label}</span><strong>{money(amount)}</strong><small>{detail}</small></article>)}</div>
        <FollowUpDesk collectionsOnly />
        <section className='finance-panel'><div className='finance-section-title'><div><span className='workspace-kicker'>AGING ANALYSIS</span><h2>Where your balance sits</h2></div><button className='text-action' onClick={() => setBucket('All')}>Show all</button></div>
            <div className='aging-grid'>{aging.map(group => <button key={group.label} className={'aging-card ' + (bucket === group.label ? 'selected' : '')} aria-pressed={bucket === group.label} onClick={() => setBucket(bucket === group.label ? 'All' : group.label)}><span>{group.label}</span><strong>{money(group.amount)}</strong><div className='aging-track'><i style={{ width: `${outstanding ? group.amount / outstanding * 100 : 0}%` }} /></div><small>{group.count} invoices</small></button>)}</div>
        </section>
        <section className='finance-panel'><div className='finance-section-title'><div><span className='workspace-kicker'>ACTION QUEUE</span><h2>{shown.length} invoices to follow up</h2></div><div className='finance-actions'><TextField id='collection-search' label='Search customer or invoice' size='small' value={query} onChange={e => setQuery(e.target.value)} /><TextField id='collection-age' select label='Age' size='small' value={bucket} onChange={e => setBucket(e.target.value)}>{['All', ...aging.map(g => g.label)].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></div></div>
            <div className='collection-queue'>{shown.slice(0, 50).map(row => <article key={row._id}><div className='account-monogram'>{row.customerName.charAt(0)}</div><div className='queue-identity'><strong>{row.customerName}</strong><span>{row.invoiceNumber || 'Legacy invoice'} · {row.dueDate ? 'Due ' + row.dueDate : 'No due date'}</span></div><span className={'queue-age ' + (row.overdueDays > 0 ? 'danger' : '')}>{row.overdueDays ? `${row.overdueDays} days overdue` : row.bucket}</span><strong className='queue-amount'>{money(row.balance)}</strong><div className='finance-actions'><Button onClick={() => { setReminder(reminderText(row)); setMessage(''); }}>Draft reminder</Button><Button component={Link} to={'/billdetails/' + row._id} aria-label={'Open invoice ' + (row.invoiceNumber || row._id)}>Open <ArrowForwardRoundedIcon fontSize='small' /></Button></div></article>)}</div>
            {shown.length > 50 && <p className='finance-note'>Showing the first 50 priorities. Narrow your search or age filter for the remaining invoices.</p>}
            {!shown.length && <div className='finance-empty'><h3>{rows.length ? 'No matches in this view' : 'Nothing outstanding'}</h3><p>{rows.length ? 'Try a different age bucket or search.' : 'Unpaid and partially paid invoices will appear here.'}</p></div>}
        </section><p className='finance-note'>Based on manually recorded payments. This is not a bank balance or cash-flow forecast. No reminders are sent automatically.</p>
        <WorkspaceDialog open={Boolean(reminder)} onClose={() => setReminder('')} aria-labelledby='reminder-title'><DialogTitle id='reminder-title'>Review payment reminder</DialogTitle><DialogContent><TextField id='payment-reminder' label='Message' multiline rows={8} fullWidth value={reminder} onChange={e => setReminder(e.target.value)} /><p role='status'>{message}</p></DialogContent><DialogActions><Button onClick={() => setReminder('')}>Close</Button><Button color='primary' onClick={copy}>Copy message</Button></DialogActions></WorkspaceDialog>
    </section>;
}
