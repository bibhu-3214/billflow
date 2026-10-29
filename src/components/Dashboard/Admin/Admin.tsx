import { ui, stagger } from '../../../styles/ui';
import { Users as PeopleAltRoundedIcon, Package as LocalMallRoundedIcon, ReceiptText as ReceiptRoundedIcon, TrendingUp as TrendingUpRoundedIcon, Building2 as BusinessRoundedIcon, Mail as MailOutlineRoundedIcon, MapPin as RoomOutlinedIcon, ArrowUpRight as ArrowUpwardRoundedIcon } from 'lucide-react';
import { Button } from '../../ui/primitives';
import { useAppSelector as useSelector } from '../../../Redux/hooks';
import React from 'react';

import BarChart from './BarChart';

import { Link } from 'react-router-dom';
import { receivableRows } from '../../../utils/receivables';
import { money } from '../../../utils/indiaBilling';
import StockDesk from '../StockDesk';
import FollowUpDesk from '../FollowUpDesk';

export default function Admin() {
    const customers = useSelector(state => state.customers);
    const products = useSelector(state => state.products);
    const { bills } = useSelector(state => state.bills);
    const { userDetails } = useSelector(state => state.users);
    const revenue = bills.filter(bill => !bill.cancellation && !bill.creditNote).reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const activeCount = bills.filter(bill => !bill.cancellation && !bill.creditNote).length;
    const averageInvoice = activeCount ? Math.round(revenue / activeCount) : 0;
    const openInvoices = receivableRows(bills, customers).filter(row => row.balance > 0);
    const overdueInvoices = openInvoices.filter(row => row.overdueDays > 0);
    const today = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(new Date());

    const metrics = [
        {
            label: 'Customers',
            value: customers.length,
            detail: customers.length ? 'Profiles in your workspace' : 'Add your first customer',
            icon: <PeopleAltRoundedIcon />,
            tone: 'violet',
        },
        {
            label: 'Products',
            value: products.length,
            detail: products.length ? 'Ready to add to invoices' : 'Build your catalog',
            icon: <LocalMallRoundedIcon />,
            tone: 'teal',
        },
        {
            label: 'Invoices',
            value: bills.length,
            detail: bills.length ? `₹${averageInvoice.toLocaleString('en-IN')} average value` : 'No invoices generated yet',
            icon: <ReceiptRoundedIcon />,
            tone: 'amber',
        },
        {
            label: 'Total invoiced',
            value: `₹${revenue.toLocaleString('en-IN')}`,
            detail: 'Invoice value including tax',
            icon: <TrendingUpRoundedIcon />,
            tone: 'blue',
        },
    ];

    return (
        <section className={ui("dashboard-page page-enter")}>
            <header className={ui("overview-hero")}>
                <div className={ui("overview-orb overview-orb-one")} />
                <div className={ui("overview-orb overview-orb-two")} />
                <div className={ui("overview-copy")}>
                    <span className={ui("overview-date")}>{today}</span>
                    <h1>Good to see you, {userDetails.username || 'there'}.</h1>
                    <p>{overdueInvoices.length ? `${overdueInvoices.length} overdue invoices need your attention.` : 'A clear view of your billing, balances and next steps.'}</p>
                </div>
                <div className={ui("overview-revenue")}>
                    <span>Total invoiced · including tax</span>
                    <strong>₹{revenue.toLocaleString('en-IN')}</strong>
                    <div><ArrowUpwardRoundedIcon /> Across {bills.length} invoice{bills.length === 1 ? '' : 's'}</div>
                </div>
            </header>
            <div className={ui("section-heading")}>
                <div><span>At a glance</span><h2>Workspace performance</h2></div>
                <div className={ui("live-chip")}><span /> Stored on this browser</div>
            </div>
            <div className={ui("metric-grid")}>
                {metrics.map((metric, index) => (
                    <article className={ui("metric-card surface-card", stagger[index])} key={metric.label}>
                        <div className={ui("metric-card-top")}>
                            <div className={ui(`metric-icon ${metric.tone}`)}>{metric.icon}</div>
                        </div>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>{metric.detail}</small>
                    </article>
                ))}
            </div>
            <div className={ui("collection-callout")}><div><span className={ui("workspace-kicker")}>YOUR NEXT ACTION</span><h2>{money(overdueInvoices.reduce((sum, row) => sum + row.balance, 0))} awaiting follow-up</h2><p>{overdueInvoices.length} overdue invoices · {openInvoices.length} open invoices overall</p></div><Button asChild  variant='contained' color='primary'><Link to='/receivables'>Review collections</Link></Button></div>
            <div className={ui("overview-operations-grid")}><StockDesk compact /><FollowUpDesk compact /></div>
            <div className={ui("dashboard-grid")}>
                <article className={ui("chart-card surface-card")}>
                    <div className={ui("card-heading")}>
                        <div><span>Performance</span><h2>Invoice value trend</h2></div>
                        <span className={ui("period-chip")}>Last 6 months</span>
                    </div>
                    <BarChart />
                </article>
                <article className={ui("profile-card surface-card")}>
                    <div className={ui("card-heading")}><div><span>Account</span><h2>Business profile</h2></div></div>
                    <div className={ui("profile-avatar")}>{(userDetails.businessName || 'B').charAt(0).toUpperCase()}</div>
                    <h3>{userDetails.businessName || 'Your business'}</h3>
                    <p className={ui("profile-owner")}>{userDetails.username || 'Business owner'}</p>
                    <div className={ui("profile-details")}>
                        <div><MailOutlineRoundedIcon /><span>{userDetails.email || 'Email unavailable'}</span></div>
                        <div><BusinessRoundedIcon /><span>{userDetails.businessName || 'Business name unavailable'}</span></div>
                        <div><RoomOutlinedIcon /><span>{userDetails.address || 'Address unavailable'}</span></div>
                    </div>
                </article>
            </div>
        </section>
    );
}
