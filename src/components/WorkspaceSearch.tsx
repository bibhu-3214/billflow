import { ui } from '../styles/ui';
import { Search as SearchRoundedIcon } from 'lucide-react';
import { DialogTitle, DialogContent, TextField, Button } from './ui/primitives';
import { useAppSelector as useSelector } from '../Redux/hooks';
import React, { useEffect, useMemo, useState } from 'react';

import { useHistory } from 'react-router-dom';

import WorkspaceDialog from './WorkspaceDialog';

interface SearchResult { name: string; path: string; type: string; detail?: string }
const destinations = [
    ['Overview', '/admin'], ['Invoices', '/billing'], ['Collections', '/receivables'],
    ['Customers', '/customer'], ['Products', '/product'], ['Business settings & backups', '/settings'], ['Customer statements', '/statements'],
];

export default function WorkspaceSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const customers = useSelector(state => state.customers);
    const { bills } = useSelector(state => state.bills);
    const history = useHistory();
    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault(); setOpen(current => !current);
            }
        };
        window.addEventListener('keydown', shortcut);
        return () => window.removeEventListener('keydown', shortcut);
    }, []);
    const results = useMemo(() => {
        const value = query.trim().toLowerCase();
        const pages: SearchResult[] = destinations.map(([name, path]) => ({ name, path, type: 'Workspace' }));
        if (!value) return pages;
        return [...pages,
            ...customers.map(customer => ({ name: customer.name, detail: customer.email, type: 'Customer statement', path: '/statements?customer=' + encodeURIComponent(customer._id) })),
            ...bills.map(bill => ({ name: bill.invoiceNumber || 'Legacy invoice', detail: (bill.customerSnapshot?.name || customers.find(c => c._id === bill.customer)?.name || '') + ' · ' + bill.date.slice(0, 10), type: 'Invoice', path: '/billdetails/' + bill._id }))]
            .filter(item => `${item.name} ${item.detail || ''} ${item.type}`.toLowerCase().includes(value)).slice(0, 12);
    }, [query, customers, bills]);
    const go = (result: SearchResult) => { history.push(result.path); setOpen(false); setQuery(''); };
    return <><button className={ui("workspace-search-trigger")} aria-label='Search workspace (Control or Command K)' onClick={() => setOpen(true)}><SearchRoundedIcon /><span>Search</span><kbd>⌘ / Ctrl K</kbd></button>
        <WorkspaceDialog open={open} onClose={() => setOpen(false)} aria-labelledby='workspace-search-title'>
            <DialogTitle id='workspace-search-title'>Find your next action</DialogTitle><DialogContent>
                <TextField id='global-search' autoFocus fullWidth label='Search pages, customers or invoices' value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && results.length) { e.preventDefault(); go(results[0]); } }} />
                <div className={ui("workspace-search-results")}>{results.map(result => <button key={result.path} onClick={() => go(result)}><div><strong>{result.name}</strong>{result.detail && <small>{result.detail}</small>}</div><span>{result.type}</span></button>)}</div>
                {!results.length && <p className={ui("finance-empty")}>No results. Try a customer name or invoice number.</p>}
                <p className={ui("finance-note")}>Enter opens the first result · Tab to choose another · Esc to close. Up to 12 matches.</p>
                <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogContent>
        </WorkspaceDialog></>;
}
