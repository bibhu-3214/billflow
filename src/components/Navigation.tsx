import { ui } from '../styles/ui';
import { LayoutDashboard as DashboardRoundedIcon, Users as PeopleAltRoundedIcon, Package as InventoryRoundedIcon, ReceiptText as ReceiptRoundedIcon, CircleUserRound as AccountCircleRoundedIcon, UserRoundPlus as PersonAddRoundedIcon, ChartNoAxesCombined as AssessmentRoundedIcon, Settings as SettingsRoundedIcon } from 'lucide-react';
import { Tooltip } from './ui/primitives';
import type { ReactNode } from 'react';
import type { RouteComponentProps } from 'react-router-dom';
import { useAppDispatch as useDispatch, useAppSelector as useSelector } from '../Redux/hooks';
import React from 'react';

import { Link, NavLink, withRouter } from 'react-router-dom';
import alerts from '../utils/alerts';

import { logout } from '../Redux/Actions/usersAction';
import WorkspaceSearch from './WorkspaceSearch';
import ThemeToggle from './ThemeToggle';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { isCloudMode } from '../data/cloudData';

function Navigation({ history }: Pick<RouteComponentProps, 'history'>) {
    const dispatch = useDispatch();
    const isLoggedIn = useSelector(state => state.users.isLoggedIn);
    const userDetails = useSelector(state => state.users.userDetails || {});
    const businessName = userDetails.businessName || 'Your workspace';
    const accountName = userDetails.username || 'Business owner';

    const handleLogout = () => {
        if (isCloudMode) {
            Promise.resolve(dispatch(logout())).then(ok => {
                if (ok) { alerts.fire('Signed out', 'Your server session was ended.', 'success'); history.push('/'); }
            });
            return;
        }
        dispatch(logout());
        alerts.fire('Signed out', 'Your local encryption key was cleared from this session.', 'success');
        history.push('/');
    };

    const navItem = (to: string, label: string, icon: ReactNode, exact = false) => (
        <li>
            <NavLink className='workspace-nav-link flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13px] font-medium text-muted transition-colors hover:bg-primary-soft/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&.active]:bg-primary-soft [&.active]:font-semibold [&.active]:text-primary [&_svg]:size-[18px] lg:w-full' aria-label={label} activeClassName='active' exact={exact} to={to}>
                {icon}<span>{label}</span>
            </NavLink>
        </li>
    );

    const publicNavItem = (to: string, label: string, icon: ReactNode, primary = false) => (
        <li>
            <Tooltip title={label} arrow>
                <NavLink className={ui(`public-auth-link${primary ? ' public-auth-link-primary' : ''}`)} aria-label={label} activeClassName='active' to={to}>
                    {icon}
                </NavLink>
            </Tooltip>
        </li>
    );

    return (
        <> <header className={ui(`topbar flagship-header ${isLoggedIn ? 'workspace-header' : 'public-header'}`)}>
            <div className={isLoggedIn ? 'mx-auto flex min-h-[76px] max-w-[1600px] items-center gap-5 px-4 sm:px-6' : ui('header-main')}>
            <Link to={isLoggedIn ? '/admin' : '/'} className={ui("brand")} aria-label='BillFlow home'>
                <span className={ui("brand-mark")}><AssessmentRoundedIcon /></span>
                <span className={ui("header-brand-copy")}><span className={ui("brand-word")}>Bill<span>Flow</span></span><span className={ui("brand-caption")}>Business, in focus.</span></span>
            </Link>
            {isLoggedIn ? <>
                <div className={ui("header-workspace")}><span className={ui("workspace-indicator")} aria-hidden='true' /><div><strong title={businessName}>{businessName}</strong><span>{userDetails.isDemo ? 'Sample workspace' : userDetails.isCloud ? 'Connected workspace' : 'Local workspace'}</span></div></div>
                <div className={ui("header-tools")}>
                    <WorkspaceSearch />
                    <ThemeToggle />
                    <Tooltip title={`${accountName} · Business settings`} arrow><Link to='/settings' className={ui("header-account")} aria-label={`Open business settings for ${accountName}`}><span className={ui("header-account-avatar")} aria-hidden='true'>{accountName.trim().charAt(0).toUpperCase() || 'B'}</span><span className={ui("header-account-copy")}><strong>{accountName}</strong><small>Business settings</small></span></Link></Tooltip>
                    <Tooltip title='Sign out' arrow><button className={ui("signout-button")} aria-label='Sign out' onClick={handleLogout} type='button'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'><path d='M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h10' /></svg></button></Tooltip>
                </div>
            </> : <div className={ui("header-tools")}><ThemeToggle /><nav aria-label='Primary navigation'><ul className={ui("nav-links public-nav")}>
                {publicNavItem('/login', 'Sign in', <AccountCircleRoundedIcon />)}
                {publicNavItem('/register', 'Create account', <PersonAddRoundedIcon />, true)}
            </ul></nav></div>}
            </div>

        </header>
        {isLoggedIn && <aside className='sticky top-[76px] z-40 border-b border-line bg-canvas/95 px-3 backdrop-blur-xl lg:fixed lg:top-[94px] lg:bottom-5 lg:left-5 lg:flex lg:w-[208px] lg:flex-col lg:rounded-2xl lg:border lg:bg-surface lg:px-3 lg:py-4 lg:shadow-[0_6px_24px_#17203304]'>
            <span className='mb-3 hidden px-3 text-[10px] font-semibold tracking-[.16em] text-muted uppercase lg:block'>Workspace</span>
            <nav aria-label='Primary navigation' className='min-w-0'><ul className='flex gap-1 overflow-x-auto py-2 lg:flex-col lg:overflow-visible lg:py-0'>
                {navItem('/admin', 'Overview', <DashboardRoundedIcon />, true)}
                {navItem('/billing', 'Invoices', <ReceiptRoundedIcon />)}
                {navItem('/receivables', 'Collections', <AssessmentRoundedIcon />)}
                {navItem('/customer', 'Customers', <PeopleAltRoundedIcon />)}
                {navItem('/product', 'Products', <InventoryRoundedIcon />)}
                {navItem('/statements', 'Statements', <FileSpreadsheet />)}
                {navItem('/settings', 'Settings', <SettingsRoundedIcon />)}
                {navItem('/help', 'Help', <AccountCircleRoundedIcon />)}
            </ul></nav>
            <div className='mt-auto hidden border-t border-line pt-4 lg:block'>
                <Link to='/billing?compose=invoice' className='flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 dark:text-[#181a31]'><Plus size={16} aria-hidden='true' />New invoice</Link>
                <p className='mt-4 text-center text-[11px] text-muted'><kbd className='rounded border border-line px-1.5 py-0.5'>Ctrl / ⌘ K</kbd><span className='ml-2'>Quick search</span></p>
            </div>
        </aside>}
        </>
    );
}

export default withRouter(Navigation);
