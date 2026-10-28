import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from './Redux/configureStore';
import { usersDetails } from './Redux/Actions/usersAction';
import { getCustomers } from './Redux/Actions/customersAction';
import { getProducts } from './Redux/Actions/productAction';
import { getBills } from './Redux/Actions/billAction';
import AppearanceProvider from './AppearanceProvider';
import localData from './data/localData';
import { LOGIN, LOGOUT } from './Redux/actionTypes';

async function start() {
if (localData.initialize) await localData.initialize();
const store = configureStore();
if (localData.hasActiveSession()) {
    store.dispatch({ type: LOGIN });
    const hasValidSession = store.dispatch(usersDetails());
    if (hasValidSession) {
        Promise.all([store.dispatch(getCustomers()), store.dispatch(getProducts()), store.dispatch(getBills())]);
    }
}

ReactDOM.render(
    <Provider store={store}>
        <AppearanceProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </AppearanceProvider>
    </Provider>,
    document.getElementById('root'),
);
if (localData.isCloud) window.addEventListener('billflow:session-expired', () => store.dispatch({ type: LOGOUT }));
}

start().catch(() => {
    const root = document.getElementById('root');
    root.replaceChildren();
    const message = document.createElement('p');
    message.textContent = 'Your workspace is temporarily unavailable. Reload to reconnect.';
    message.setAttribute('role', 'alert');
    const button = document.createElement('button');
    button.textContent = 'Try again';
    button.onclick = () => window.location.reload();
    root.append(message, button);
});
