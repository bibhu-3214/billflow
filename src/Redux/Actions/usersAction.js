import Swal from 'sweetalert2';
import localData from '../../data/localData';
import { getCustomers } from './customersAction';
import { getProducts } from './productAction';
import { getBills } from './billAction';
import { LOGIN, LOGOUT, USER_INFORMATION } from '../actionTypes';

const showError = error => !error.cancelled && Swal.fire('Unable to continue', error.message, 'error');

export const register = (values, onSuccess) => async () => {
    try {
        await localData.register(values);
        await Swal.fire('Workspace created', localData.isCloud ? 'Check your email to verify your address, then sign in.' : 'You can now sign in.', 'success');
        onSuccess();
    } catch (error) {
        showError(error);
    }
};

export const login = (values, onSuccess) => async dispatch => {
    try {
        const session = await localData.login(values);
        dispatch({ type: LOGIN });
        dispatch({ type: USER_INFORMATION, payload: session.user });
        await Promise.all([dispatch(getCustomers()), dispatch(getProducts()), dispatch(getBills())]);
        await Swal.fire('Welcome back', 'Your workspace is ready.', 'success');
        onSuccess();
    } catch (error) {
        showError(error);
    }
};

export const logout = () => {
    if (localData.isCloud) return async dispatch => {
        try {
            await localData.clearSession();
            dispatch({ type: LOGOUT });
            return true;
        } catch (error) { showError(error); return false; }
    };
    localData.clearSession();
    return { type: LOGOUT };
};

export const usersDetails = () => dispatch => {
    try {
        dispatch({ type: USER_INFORMATION, payload: localData.getCurrentUser() });
        return true;
    } catch (error) {
        localData.clearSession();
        dispatch({ type: LOGOUT });
        return false;
    }
};
