import React from 'react';
import DashboardRoundedIcon from '@material-ui/icons/DashboardRounded';
import PeopleAltRoundedIcon from '@material-ui/icons/PeopleAltRounded';
import InventoryRoundedIcon from '@material-ui/icons/LocalMallRounded';
import ReceiptRoundedIcon from '@material-ui/icons/ReceiptRounded';
import AccountCircleRoundedIcon from '@material-ui/icons/AccountCircleRounded';
import PersonAddRoundedIcon from '@material-ui/icons/PersonAddRounded';
import AssessmentRoundedIcon from '@material-ui/icons/AssessmentRounded';
import Tooltip from '@material-ui/core/Tooltip';
import SettingsRoundedIcon from '@material-ui/icons/SettingsRounded';
import { Link, NavLink, withRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../Redux/Actions/usersAction';
import WorkspaceSearch from './WorkspaceSearch';
import ThemeToggle from './ThemeToggle';
import { isCloudMode } from '../data/cloudData';

function Navigation({ history }) {
    const dispatch = useDispatch();
    const isLoggedIn = useSelector(state => state.users.isLoggedIn);
    const userDetails = useSelector(state => state.users.userDetails || {});
    const businessName = userDetails.businessName || 'Your workspace';
    const accountName = userDetails.username || 'Business owner';

    const handleLogout = () => {
        if (isCloudMode) {
            dispatch(logout()).then(ok => {
                if (ok) { Swal.fire('Signed out', 'Your server session was ended.', 'success'); history.push('/'); }
            });
            return;
        }
        dispatch(logout());
        Swal.fire('Signed out', 'Your local encryption key was cleared from this session.', 'success');
        history.push('/');
    };

    const navItem = (to, label, icon, exact = false) => (
        <li>
            <NavLink className='nav-link' aria-label={label} activeClassName='active' exact={exact} to={to}>
                {icon}<span>{label}</span>
            </NavLink>
        </li>
    );

    return (
        <header className={`topbar flagship-header ${isLoggedIn ? 'workspace-header' : 'public-header'}`}>
            <div className='header-main'>
            <Link to={isLoggedIn ? '/admin' : '/'} className='brand' aria-label='BillFlow home'>
                <span className='brand-mark'><AssessmentRoundedIcon /></span>
                <span className='header-brand-copy'><span className='brand-word'>Bill<span>Flow</span></span><span className='brand-caption'>Business, in focus.</span></span>
            </Link>
            {isLoggedIn ? <>
                <div className='header-workspace'><span className='workspace-indicator' aria-hidden='true' /><div><strong title={businessName}>{businessName}</strong><span>{userDetails.isDemo ? 'Sample workspace' : userDetails.isCloud ? 'Connected workspace' : 'Local workspace'}</span></div></div>
                <div className='header-tools'>
                    <WorkspaceSearch />
                    <ThemeToggle />
                    <Tooltip title={`${accountName} · Business settings`} arrow><Link to='/settings' className='header-account' aria-label={`Open business settings for ${accountName}`}><span className='header-account-avatar' aria-hidden='true'>{accountName.trim().charAt(0).toUpperCase() || 'B'}</span><span className='header-account-copy'><strong>{accountName}</strong><small>Business settings</small></span></Link></Tooltip>
                    <Tooltip title='Sign out' arrow><button className='signout-button' aria-label='Sign out' onClick={handleLogout} type='button'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'><path d='M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h10' /></svg></button></Tooltip>
                </div>
            </> : <div className='header-tools'><ThemeToggle /><nav aria-label='Primary navigation'><ul className='nav-links public-nav'>
                {navItem('/login', 'Sign in', <AccountCircleRoundedIcon />)}
                {navItem('/register', 'Create account', <PersonAddRoundedIcon />)}
            </ul></nav></div>}
            </div>
            {isLoggedIn && <div className='header-navigation-row'><nav aria-label='Primary navigation'><ul className='nav-links'>
                            {navItem('/admin', 'Overview', <DashboardRoundedIcon />, true)}
                            {navItem('/customer', 'Customers', <PeopleAltRoundedIcon />)}
                            {navItem('/product', 'Products', <InventoryRoundedIcon />)}
                            {navItem('/billing', 'Invoices', <ReceiptRoundedIcon />)}
                            {navItem('/receivables', 'Collections', <AssessmentRoundedIcon />)}
                            {navItem('/settings', 'Settings', <SettingsRoundedIcon />)}
                            {navItem('/help', 'Help', <AccountCircleRoundedIcon />)}
            </ul></nav><span className='header-mode-label'>YOUR OPERATIONS DESK</span></div>}
        </header>
    );
}

export default withRouter(Navigation);
