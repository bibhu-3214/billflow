import type { AppAction } from '../types';
import billReducer from './billReducer';
import customersReducer from './customersReducer';
import productReducer from './productReducer';
import { ADD_BILL, GET_BILL_BY_ID, REMOVE_CUSTOMER, REMOVE_PRODUCT } from '../actionTypes';

describe('reducers', () => {
    test('an idempotent invoice issuance retry does not duplicate invoice rows', () => {
        const bill = { customer: 'c', date: '2026-10-08', total: 1, lineItems: [], _id: 'b1', invoiceNumber: 'BF/2627/000001' };
        const first = billReducer(undefined, { type: ADD_BILL, payload: bill });
        expect(billReducer(first, { type: ADD_BILL, payload: bill }).bills).toEqual([bill]);
    });
    test('unknown actions preserve state references', () => {
        const products = [{ _id: 'p1', name: 'Product', price: 1 }];
        const customers = [{ _id: 'c1', name: 'Buyer', email: '', mobile: '' }];
        const bills = { bills: [], billDetails: {} };

        expect(productReducer(products, { type: 'UNKNOWN' } as unknown as AppAction)).toBe(products);
        expect(customersReducer(customers, { type: 'UNKNOWN' } as unknown as AppAction)).toBe(customers);
        expect(billReducer(bills, { type: 'UNKNOWN' } as unknown as AppAction)).toBe(bills);
    });

    test('removes products and customers by id', () => {
        const records = [{ _id: '1', name: 'One', price: 1, email: '', mobile: '' }, { _id: '2', name: 'Two', price: 2, email: '', mobile: '' }];

        expect(productReducer(records, { type: REMOVE_PRODUCT, payload: records[0] })).toEqual([
            records[1],
        ]);
        expect(customersReducer(records, { type: REMOVE_CUSTOMER, payload: records[1] })).toEqual([
            records[0],
        ]);
    });

    test('bill details use a bill-specific action', () => {
        const state = { bills: [], billDetails: {} };
        const bill = { customer: 'c', date: '2026-10-08', total: 1, lineItems: [], _id: 'b1' };

        expect(billReducer(state, { type: GET_BILL_BY_ID, payload: bill }).billDetails).toBe(bill);
        expect(billReducer(state, { type: 'GET_PRODUCT_BY_ID', payload: bill } as unknown as AppAction)).toBe(state);
    });
});
