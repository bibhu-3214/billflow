import { asAppError } from '../../types/domain';
import type { AppThunk, SaveResult } from '../types';
import type { CustomerInput, AppError } from '../../types/domain';
import alerts from '../../utils/alerts';
import localData from '../../data/localData';
import { ADD_CUSTOMER, EDIT_CUSTOMER, GET_CUSTOMERS, REMOVE_CUSTOMER } from '../actionTypes';

const showError = (problem: unknown) => { const error = asAppError(problem); return !error.cancelled && alerts.fire('Unable to update customers', error.message, 'error'); };

export const addCustomer = (formData: CustomerInput): AppThunk<Promise<SaveResult>> => async dispatch => {
    try {
        dispatch({ type: ADD_CUSTOMER, payload: await localData.addCustomer(formData) });
        return { ok: true };
    } catch (caughtError) { const error = asAppError(caughtError);
        return { ok: false, error: error.message };
    }
};

export const removeCustomer = (id: string): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: REMOVE_CUSTOMER, payload: await localData.removeCustomer(id) });
    } catch (error) {
        showError(error);
    }
};

export const getCustomers = (): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: GET_CUSTOMERS, payload: await localData.getCustomers() });
    } catch (error) {
        showError(error);
    }
};

export const editCustomer = (values: CustomerInput, id: string): AppThunk<Promise<SaveResult>> => async dispatch => {
    try {
        dispatch({ type: EDIT_CUSTOMER, payload: await localData.editCustomer(id, values) });
        return { ok: true };
    } catch (caughtError) { const error = asAppError(caughtError);
        return { ok: false, error: error.message };
    }
};
