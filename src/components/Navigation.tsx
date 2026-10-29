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
            <NavLink className={ui("nav-link")} aria-label={label} activeClassName='active' exact={exact} to={to}>
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
        <header className={ui(`topbar flagship-header ${isLoggedIn ? 'workspace-header' : 'public-header'}`)}>
            <div className={ui("header-main")}>
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
            {isLoggedIn && <div className={ui("header-navigation-row")}><nav aria-label='Primary navigation'><ul className={ui("nav-links")}>
                            {navItem('/admin', 'Overview', <DashboardRoundedIcon />, true)}
                            {navItem('/customer', 'Customers', <PeopleAltRoundedIcon />)}
                            {navItem('/product', 'Products', <InventoryRoundedIcon />)}
                            {navItem('/billing', 'Invoices', <ReceiptRoundedIcon />)}
                            {navItem('/receivables', 'Collections', <AssessmentRoundedIcon />)}
                            {navItem('/settings', 'Settings', <SettingsRoundedIcon />)}
                            {navItem('/help', 'Help', <AccountCircleRoundedIcon />)}
            </ul></nav><span className={ui("header-mode-label")}>YOUR OPERATIONS DESK</span></div>}
        </header>
    );
}

export default withRouter(Navigation);
