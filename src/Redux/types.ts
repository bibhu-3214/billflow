import * as A from './actionTypes';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import type { Customer, Invoice, Product, UserProfile } from '../types/domain';
export interface RootState { users: { isLoggedIn: boolean; userDetails: Partial<UserProfile> }; customers: Customer[]; products: Product[]; bills: { bills: Invoice[]; billDetails: Partial<Invoice> } }
export type AppAction =
    | { type: typeof A.LOGIN | typeof A.LOGOUT }
    | { type: typeof A.USER_INFORMATION; payload: UserProfile }
    | { type: typeof A.ADD_CUSTOMER | typeof A.EDIT_CUSTOMER | typeof A.REMOVE_CUSTOMER; payload: Customer }
    | { type: typeof A.GET_CUSTOMERS; payload: Customer[] }
    | { type: typeof A.ADD_PRODUCT | typeof A.EDIT_PRODUCT | typeof A.REMOVE_PRODUCT; payload: Product }
    | { type: typeof A.GET_PRODUCTS; payload: Product[] }
    | { type: typeof A.ADD_BILL | typeof A.GET_BILL_BY_ID; payload: Invoice }
    | { type: typeof A.GET_BILLS; payload: Invoice[] }
    | { type: typeof A.REMOVE_BILL; payload: string };
export type SaveResult = { ok: true } | { ok: false; error: string };

export type AppThunk<Return = unknown> = ThunkAction<Return, RootState, unknown, AppAction>;
export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;
