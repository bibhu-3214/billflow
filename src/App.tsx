import { ui } from './styles/ui';
import AlertHost from './components/AlertHost';
import { useAppSelector as useSelector } from './Redux/hooks';
import { Route, Switch } from 'react-router-dom';

import PrivateRoute from './helper/PrivateRoute';
import ProtectedRoute from './helper/ProtectedRoute';
import Navigation from './components/Navigation';
import Home from './components/Authentication/Home';
import Register from './components/Authentication/Register';
import Login from './components/Authentication/Login';
import Admin from './components/Dashboard/Admin/Admin';
import CustomerContainer from './components/Dashboard/customers/CustomerContainer';
import ProductContainer from './components/Dashboard/products/ProductContainer';
import BillContainer from './components/Dashboard/bills/BillContainer';
import ShowBillsById from './components/Dashboard/bills/ShowBillsById';
import BusinessSettings from './components/Dashboard/BusinessSettings';
import CustomerStatement from './components/Dashboard/customers/CustomerStatement';
import Receivables from './components/Dashboard/Receivables';
import RouteScrollReset from './helper/RouteScrollReset';
import AccountRecovery from './components/Authentication/AccountRecovery';
import Help from './components/Help';

const App = () => {
    const users = useSelector(state => state.users);
    const isDemo = users.userDetails.isDemo;
    return (
        <div className={ui("app-shell")}>
            <RouteScrollReset />
            <a className={ui("skip-link")} href="#main-content">Skip to content</a>
            <Navigation /><AlertHost />
            <main className={ui("app-content")} id="main-content" tabIndex={-1}>
                {isDemo && <aside className={ui("demo-notice")} aria-label='Sample workspace'>
                    <strong>Sample workspace</strong> · Fictional data. Changes stay in this tab. Sign out and reopen the demo to reset.
                </aside>}
                <Switch>
                    <Route path='/account' component={AccountRecovery} exact />
                    <Route path='/help' component={Help} exact />
                    <PrivateRoute path='/receivables' component={Receivables} exact />
                    <PrivateRoute path='/statements' component={CustomerStatement} exact />
                    <PrivateRoute path='/settings' component={BusinessSettings} exact />
                    <PrivateRoute path='/billdetails/:id' component={ShowBillsById} exact />
                    <PrivateRoute path='/billing' component={BillContainer} exact />
                    <PrivateRoute path='/product' component={ProductContainer} exact />
                    <PrivateRoute path='/customer' component={CustomerContainer} exact />
                    <PrivateRoute path='/admin' component={Admin} exact />
                    <ProtectedRoute path='/login' component={Login} exact />
                    <ProtectedRoute path='/register' component={Register} exact />
                    <ProtectedRoute path='/' component={Home} exact />
                </Switch>
            </main>
        </div>
    );
};

export default App;
