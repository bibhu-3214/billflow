import Swal from 'sweetalert2';
import localData from '../../data/localData';
import { ADD_BILL, GET_BILLS, GET_BILL_BY_ID, REMOVE_BILL } from '../actionTypes';

const showError = error => !error.cancelled && Swal.fire('Unable to update invoices', error.message, 'error');

export const correctInvoice = (id, values) => async dispatch => {
    try {
        const bill = await localData.correctInvoice(id, values);
        dispatch({ type: GET_BILL_BY_ID, payload: bill });
        await dispatch(getBills());
        return true;
    } catch (error) { showError(error); return false; }
};

export const recordPayment = (id, values, onSuccess) => async dispatch => {
    try {
        const bill = await localData.recordPayment(id, values);
        dispatch({ type: GET_BILL_BY_ID, payload: bill });
        await dispatch(getBills());
        onSuccess();
    } catch (error) { showError(error); }
};

export const addBill = (formData, onSuccess) => async dispatch => {
    try {
        const bill = await localData.addBill(formData);
        dispatch({ type: ADD_BILL, payload: bill });
        onSuccess(bill._id);
        return { ok: true, bill };
    } catch (error) {
        return { ok: false, error: error.message };
    }
};

export const removeBill = id => async dispatch => {
    try {
        const bill = await localData.removeBill(id);
        dispatch({ type: REMOVE_BILL, payload: bill._id });
    } catch (error) {
        showError(error);
    }
};

export const getBills = () => async dispatch => {
    try {
        dispatch({ type: GET_BILLS, payload: (await localData.getBills()).reverse() });
    } catch (error) {
        showError(error);
    }
};

export const getBillById = id => async dispatch => {
    try {
        dispatch({ type: GET_BILL_BY_ID, payload: await localData.getBill(id) });
    } catch (error) {
        showError(error);
    }
};
