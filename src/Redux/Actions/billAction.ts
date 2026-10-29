import { asAppError } from '../../types/domain';
import type { AppThunk } from '../types';
import type { Invoice, InvoiceInput, PaymentInput, CorrectionInput, AppError } from '../../types/domain';
import alerts from '../../utils/alerts';
import localData from '../../data/localData';
import { ADD_BILL, GET_BILLS, GET_BILL_BY_ID, REMOVE_BILL } from '../actionTypes';

const showError = (problem: unknown) => { const error = asAppError(problem); return !error.cancelled && alerts.fire('Unable to update invoices', error.message, 'error'); };

export const correctInvoice = (id: string, values: CorrectionInput): AppThunk<Promise<boolean>> => async dispatch => {
    try {
        const bill = await localData.correctInvoice(id, values);
        dispatch({ type: GET_BILL_BY_ID, payload: bill });
        await dispatch(getBills());
        return true;
    } catch (error) { showError(error); return false; }
};

export const recordPayment = (id: string, values: PaymentInput, onSuccess: () => void): AppThunk<Promise<void>> => async dispatch => {
    try {
        const bill = await localData.recordPayment(id, values);
        dispatch({ type: GET_BILL_BY_ID, payload: bill });
        await dispatch(getBills());
        onSuccess();
    } catch (error) { showError(error); }
};

export const addBill = (formData: InvoiceInput, onSuccess: (id: string) => void): AppThunk<Promise<{ ok: true; bill: Invoice } | { ok: false; error: string }>> => async dispatch => {
    try {
        const bill = await localData.addBill(formData);
        dispatch({ type: ADD_BILL, payload: bill });
        onSuccess(bill._id);
        return { ok: true, bill };
    } catch (caughtError) { const error = asAppError(caughtError);
        return { ok: false, error: error.message };
    }
};

export const removeBill = (id: string): AppThunk<Promise<void>> => async dispatch => {
    try {
        const bill = await localData.removeBill(id);
        dispatch({ type: REMOVE_BILL, payload: bill._id });
    } catch (error) {
        showError(error);
    }
};

export const getBills = (): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: GET_BILLS, payload: (await localData.getBills()).reverse() });
    } catch (error) {
        showError(error);
    }
};

export const getBillById = (id: string): AppThunk<Promise<void>> => async dispatch => {
    try {
        dispatch({ type: GET_BILL_BY_ID, payload: await localData.getBill(id) });
    } catch (error) {
        showError(error);
    }
};
