import type { AppAction, RootState } from '../types';
import { ADD_BILL, GET_BILLS, GET_BILL_BY_ID, REMOVE_BILL } from '../actionTypes';

const billsInitialState: { data: RootState['bills'] } = { data: { bills: [], billDetails: {} } };

const billReducer = (state: RootState['bills'] = billsInitialState.data, action: AppAction) => {
    switch (action.type) {
        case ADD_BILL: {
            const billData = [action.payload, ...state.bills.filter(bill => bill._id !== action.payload._id)];
            return { ...state, bills: billData };
        }
        case GET_BILLS: {
            return { ...state, bills: action.payload };
        }
        case REMOVE_BILL: {
            const result = state.bills.filter((bill) => bill._id !== action.payload);
            return { ...state, bills: result };
        }
        case GET_BILL_BY_ID: {
            return { ...state, billDetails: action.payload };
        }
        default: {
            return state;
        }
    }
};

export default billReducer;
