import { asAppError } from '../../types/domain';
import type { AppAction, AppThunk } from '../types';
import type { Registration, Credentials, AppError } from '../../types/domain';
import alerts from '../../utils/alerts';
import localData from '../../data/localData';
import { getCustomers } from './customersAction';
import { getProducts } from './productAction';
import { getBills } from './billAction';
import { LOGIN, LOGOUT, USER_INFORMATION } from '../actionTypes';

const showError = (problem: unknown) => { const error = asAppError(problem); return !error.cancelled && alerts.fire('Unable to continue', error.message, 'error'); };

export const register = (values: Registration, onSuccess: () => void): AppThunk<Promise<void>> => async () => {
    try {
        await localData.register(values);
        await alerts.fire('Workspace created', localData.isCloud ? 'Check your email to verify your address, then sign in.' : 'You can now sign in.', 'success');
        onSuccess();
    } catch (error) {
        showError(error);
    }
};

export const login = (values: Credentials, onSuccess: () => void): AppThunk<Promise<void>> => async dispatch => {
    try {
        const session = await localData.login(values);
        dispatch({ type: LOGIN });
        dispatch({ type: USER_INFORMATION, payload: session.user });
        await Promise.all([dispatch(getCustomers()), dispatch(getProducts()), dispatch(getBills())]);
        await alerts.fire('Welcome back', 'Your workspace is ready.', 'success');
        onSuccess();
    } catch (error) {
        showError(error);
    }
};

export const logout = (): AppThunk<Promise<boolean>> | AppAction => {
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

export const usersDetails = (): AppThunk<boolean> => dispatch => {
    try {
        dispatch({ type: USER_INFORMATION, payload: localData.getCurrentUser() });
        return true;
    } catch (error) {
        localData.clearSession();
        dispatch({ type: LOGOUT });
        return false;
    }
};
