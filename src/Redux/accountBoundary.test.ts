import configureStore from './configureStore';
import { GET_CUSTOMERS, GET_PRODUCTS, GET_BILLS, GET_BILL_BY_ID, USER_INFORMATION, LOGIN, LOGOUT } from './actionTypes';

test('sign-out removes every private collection and detail before another account opens', () => {
    const store = configureStore();
    store.dispatch({ type: LOGIN });
    store.dispatch({ type: USER_INFORMATION, payload: { _id: 'previous-account', username: 'Owner', email: 'owner@example.test', businessName: 'Shop', address: 'Mumbai' } });
    store.dispatch({type: GET_CUSTOMERS, payload: [{_id: 'private-record', name: 'Buyer', email: '', mobile: ''}]});
    store.dispatch({type: GET_PRODUCTS, payload: [{_id: 'private-record', name: 'Product', price: 1}]});
    store.dispatch({type: GET_BILLS, payload: [{_id: 'private-record', customer: 'c', date: '2026-10-08', total: 1, lineItems: []}]});
    store.dispatch({ type: GET_BILL_BY_ID, payload: { _id: 'private-invoice', customer: 'c', date: '2026-10-08', total: 1, lineItems: [] } });
    store.dispatch({ type: LOGOUT });
    expect(store.getState()).toMatchObject({ users: { isLoggedIn: false, userDetails: {} }, customers: [], products: [], bills: { bills: [], billDetails: {} } });
});
