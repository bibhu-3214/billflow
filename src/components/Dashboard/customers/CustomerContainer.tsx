import { ui } from '../../../styles/ui';
import { Plus as AddIcon, Search as Search, Users as PeopleAltRoundedIcon } from 'lucide-react';
import { Button, InputAdornment, Paper, Toolbar, Typography } from '../../ui/primitives';
import { useAppSelector as useSelector } from '../../../Redux/hooks';
import React, { useEffect, useState } from 'react';
import CustomerList from './CustomerList';

import Popup from '../../Popup';

import Input from '../../controls/Input';

import CustomerForm from './CustomerForm';

import { Link } from 'react-router-dom';
import { customerAccounts } from '../../../utils/receivables';
import FollowUpDesk from '../FollowUpDesk';

export default function CustomerContainer() {
    const [openPopup, setOpenPopup] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<ReturnType<typeof customerAccounts>[number][]>([]);
    const customers = useSelector((state) => state.customers);
    const { bills } = useSelector(state => state.bills);
    const billedCustomerIds = new Set(bills.map(bill => bill.customer));
    const billedCustomers = customers.filter(customer => billedCustomerIds.has(customer._id)).length;

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        const results = customerAccounts(customers, bills).filter(customer => `${customer.name} ${customer.company || ''} ${customer.contactPerson || ''} ${customer.email} ${customer.mobile}`.toLowerCase().includes(query));
        setSearchResult(results);
    }, [customers, bills, searchInput]);

    return (
        <section className={ui("workspace-page page-enter")}>
            <header className={ui("workspace-hero customer-workspace-hero")}>
                <div className={ui("workspace-hero-copy")}>
                    <span className={ui("workspace-kicker")}><PeopleAltRoundedIcon /> Relationships</span>
                    <h1>Customers</h1>
                    <p>Every relationship, contact, and billing profile in one place.</p>
                </div>
                <div className={ui("workspace-hero-stats")}>
                    <div><span>Total customers</span><strong>{customers.length}</strong></div>
                    <div><span>With invoices</span><strong>{billedCustomers}</strong></div>
                    <div><span>Without invoices</span><strong>{Math.max(customers.length - billedCustomers, 0)}</strong></div>
                </div>
            </header>
            <FollowUpDesk />
            <Paper className={ui("data-panel surface-card")} elevation={0}>
                <div>
                    <Toolbar className={ui("data-toolbar")}>
                        <Button asChild  color='primary'><Link to='/statements'>Customer statements</Link></Button>
                        <Input
                            label="Search customers"
                            size="small"
                            value={searchInput}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                ),
                            }}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <Button
                            variant="outlined"
                            size="large"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setOpenPopup(true);
                            }}
                        >
                            Add customer
                        </Button>
                    </Toolbar>
                </div>
                <div>
                    {customers.length > 0 ? (
                        searchResult.length ? <CustomerList searchResult={searchResult} /> : <p className={ui("finance-empty")}>No customers match your search.</p>
                    ) : (
                        <Typography
                            variant="h5"
                            color="textSecondary"
                            gutterBottom
                            className={ui("empty-state")}
                        >
                            No customers yet. Add your first customer to get started.
                        </Typography>
                    )}
                </div>
            </Paper>
            <Popup title="Customer studio" size='editor' openPopup={openPopup} setOpenPopup={setOpenPopup}>
                <CustomerForm setOpenPopup={setOpenPopup} />
            </Popup>
        </section>
    );
}
