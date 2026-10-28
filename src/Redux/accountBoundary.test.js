import configureStore from './configureStore';
import { GET_CUSTOMERS, GET_PRODUCTS, GET_BILLS, GET_BILL_BY_ID, USER_INFORMATION, LOGIN, LOGOUT } from './actionTypes';

test('sign-out removes every private collection and detail before another account opens', () => {
    const store = configureStore();
    store.dispatch({ type: LOGIN });
    store.dispatch({ type: USER_INFORMATION, payload: { _id: 'previous-account' } });
    for (const type of [GET_CUSTOMERS, GET_PRODUCTS, GET_BILLS]) store.dispatch({ type, payload: [{ _id: 'private-record' }] });
    store.dispatch({ type: GET_BILL_BY_ID, payload: { _id: 'private-invoice' } });
    store.dispatch({ type: LOGOUT });
    expect(store.getState()).toMatchObject({ users: { isLoggedIn: false, userDetails: {} }, customers: [], products: [], bills: { bills: [], billDetails: {} } });
});
