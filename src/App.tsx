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

function PageLoading() {
    return <div aria-busy='true' className='mx-auto max-w-[1200px] px-5 py-9'>
        <p role='status' className='sr-only'>Opening page…</p>
        <div aria-hidden='true' className='grid gap-6 motion-safe:animate-pulse'>
            <div className='h-7 w-2/3 max-w-md rounded-lg bg-primary-soft'/>
            <div className='h-3 w-1/2 max-w-sm rounded-full bg-line'/>
            <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>{[0,1,2,3].map(key=><div key={key} className='h-32 rounded-2xl border border-line bg-surface'/>)}</div>
            <div className='grid gap-5 lg:grid-cols-[1.7fr_1fr]'><div className='h-72 rounded-2xl border border-line bg-surface'/><div className='h-72 rounded-2xl border border-line bg-surface'/></div>
        </div>
    </div>;
}

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
                <PageBoundary key={location.pathname}><Suspense fallback={<PageLoading />}>
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
