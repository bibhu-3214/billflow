import Swal from 'sweetalert2';
import localData from '../../data/localData';
import { ADD_PRODUCT, EDIT_PRODUCT, GET_PRODUCTS, REMOVE_PRODUCT } from '../actionTypes';

const showError = error => !error.cancelled && Swal.fire('Unable to update products', error.message, 'error');

export const addProduct = formData => async dispatch => {
    try {
        dispatch({ type: ADD_PRODUCT, payload: await localData.addProduct(formData) });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
};

export const removeProducts = id => async dispatch => {
    try {
        dispatch({ type: REMOVE_PRODUCT, payload: await localData.removeProduct(id) });
    } catch (error) {
        showError(error);
    }
};

export const getProducts = () => async dispatch => {
    try {
        dispatch({ type: GET_PRODUCTS, payload: await localData.getProducts() });
    } catch (error) {
        showError(error);
    }
};

export const editProduct = (values, id) => async dispatch => {
    try {
        dispatch({ type: EDIT_PRODUCT, payload: await localData.editProduct(id, values) });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
};
