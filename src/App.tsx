import { ui } from './styles/ui';
import AlertHost from './components/AlertHost';
import { useAppSelector as useSelector } from './Redux/hooks';
import {lazy, Suspense} from 'react';
import { Route, Switch, useLocation } from 'react-router-dom';

import PageBoundary from './components/PageBoundary';
import PrivateRoute from './helper/PrivateRoute';
import ProtectedRoute from './helper/ProtectedRoute';
import Navigation from './components/Navigation';
import RouteScrollReset from './helper/RouteScrollReset';

const Home = lazy(() => import('./components/Authentication/Home'));
const Register = lazy(() => import('./components/Authentication/Register'));
const Login = lazy(() => import('./components/Authentication/Login'));
const Admin = lazy(() => import('./components/Dashboard/Admin/Admin'));
const CustomerInsights = lazy(() => import('./components/Dashboard/CustomerInsights'));
const CustomerContainer = lazy(() => import('./components/Dashboard/customers/CustomerContainer'));
const ProductContainer = lazy(() => import('./components/Dashboard/products/ProductContainer'));
const BillContainer = lazy(() => import('./components/Dashboard/bills/BillContainer'));
const ShowBillsById = lazy(() => import('./components/Dashboard/bills/ShowBillsById'));
const BusinessSettings = lazy(() => import('./components/Dashboard/BusinessSettings'));
const CustomerStatement = lazy(() => import('./components/Dashboard/customers/CustomerStatement'));
const Receivables = lazy(() => import('./components/Dashboard/Receivables'));
const AccountRecovery = lazy(() => import('./components/Authentication/AccountRecovery'));
const Help = lazy(() => import('./components/Help'));

const App = () => {
    const users = useSelector(state => state.users);
    const location = useLocation();
    const isDemo = users.userDetails.isDemo;
    return (
        <div className={ui("app-shell")}>
            <RouteScrollReset />
            <a className={ui("skip-link")} href="#main-content">Skip to content</a>
            <Navigation /><AlertHost />
            <main className={ui("app-content", users.isLoggedIn && "lg:pl-[232px]")} id="main-content" tabIndex={-1}>
                {isDemo && <aside className={ui("demo-notice")} aria-label='Sample workspace'>
                    <strong>Sample workspace</strong> · Fictional data. Changes stay in this tab. Sign out and reopen the demo to reset.
                </aside>}
                <PageBoundary key={location.pathname}><Suspense fallback={<div role='status' className='mx-auto max-w-[1104px] px-5 py-12 text-sm text-muted'><span className='mb-4 block h-2 w-32 animate-pulse rounded-full bg-primary-soft motion-reduce:animate-none' />Opening page…</div>}>
                <Switch>
                    <Route path='/account' component={AccountRecovery} exact />
                    <Route path='/help' component={Help} exact />
                    <PrivateRoute path='/receivables' component={Receivables} exact />
                    <PrivateRoute path='/statements' component={CustomerStatement} exact />
                    <PrivateRoute path='/settings' component={BusinessSettings} exact />
                    <PrivateRoute path='/billdetails/:id' component={ShowBillsById} exact />
                    <PrivateRoute path='/billing' component={BillContainer} exact />
                    <PrivateRoute path='/product' component={ProductContainer} exact />
                    <PrivateRoute path='/customer-insights' component={CustomerInsights} exact />
                    <PrivateRoute path='/customer' component={CustomerContainer} exact />
                    <PrivateRoute path='/admin' component={Admin} exact />
                    <ProtectedRoute path='/login' component={Login} exact />
                    <ProtectedRoute path='/register' component={Register} exact />
                    <ProtectedRoute path='/' component={Home} exact />
                </Switch>
                </Suspense></PageBoundary>
            </main>
        </div>
    );
};

export default App;
