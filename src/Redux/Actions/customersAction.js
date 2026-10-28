import Swal from 'sweetalert2';
import localData from '../../data/localData';
import { ADD_CUSTOMER, EDIT_CUSTOMER, GET_CUSTOMERS, REMOVE_CUSTOMER } from '../actionTypes';

const showError = error => !error.cancelled && Swal.fire('Unable to update customers', error.message, 'error');

export const addCustomer = formData => async dispatch => {
    try {
        dispatch({ type: ADD_CUSTOMER, payload: await localData.addCustomer(formData) });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
};

export const removeCustomer = id => async dispatch => {
    try {
        dispatch({ type: REMOVE_CUSTOMER, payload: await localData.removeCustomer(id) });
    } catch (error) {
        showError(error);
    }
};

export const getCustomers = () => async dispatch => {
    try {
        dispatch({ type: GET_CUSTOMERS, payload: await localData.getCustomers() });
    } catch (error) {
        showError(error);
    }
};

export const editCustomer = (values, id) => async dispatch => {
    try {
        dispatch({ type: EDIT_CUSTOMER, payload: await localData.editCustomer(id, values) });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
};
