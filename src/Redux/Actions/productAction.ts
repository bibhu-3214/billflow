import { asAppError } from '../../types/domain';
import type { AppThunk, SaveResult } from '../types';
import type { ProductInput, AppError } from '../../types/domain';
import alerts from '../../utils/alerts';
import localData from '../../data/localData';
import { ADD_PRODUCT, EDIT_PRODUCT, GET_PRODUCTS, REMOVE_PRODUCT } from '../actionTypes';

const showError = (problem: unknown) => { const error = asAppError(problem); return !error.cancelled && alerts.fire('Unable to update products', error.message, 'error'); };

export const addProduct = (formData: ProductInput): AppThunk<Promise<SaveResult>> => async dispatch => {
    try {
        dispatch({ type: ADD_PRODUCT, payload: await localData.addProduct(formData) });
        return { ok: true };
    } catch (caughtError) { const error = asAppError(caughtError);
        return { ok: false, error: error.message };
    }
};

export const removeProducts = (id: string): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: REMOVE_PRODUCT, payload: await localData.removeProduct(id) });
    } catch (error) {
        showError(error);
    }
};

export const getProducts = (): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: GET_PRODUCTS, payload: await localData.getProducts() });
    } catch (error) {
        showError(error);
    }
};

export const editProduct = (values: ProductInput, id: string): AppThunk<Promise<SaveResult>> => async dispatch => {
    try {
        dispatch({ type: EDIT_PRODUCT, payload: await localData.editProduct(id, values) });
        return { ok: true };
    } catch (caughtError) { const error = asAppError(caughtError);
        return { ok: false, error: error.message };
    }
};
