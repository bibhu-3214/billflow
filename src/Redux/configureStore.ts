import type { AppAction, AppDispatch, RootState } from './types';
import type { Store } from 'redux';
import type { ThunkMiddleware } from 'redux-thunk';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import customersReducer from './Reducers/customersReducer';
import userReducer from './Reducers/userReducer';
import productReducer from './Reducers/productReducer';
import billReducer from './Reducers/billReducer';
import { LOGOUT } from './actionTypes';

const reducers = combineReducers({ users: userReducer, customers: customersReducer,
   products: productReducer, bills: billReducer });
const accountReducer = (state: RootState | undefined, action: AppAction) => reducers(action.type === LOGOUT ? undefined : state, action);

const configureStore = (): Store<RootState, AppAction> & { dispatch: AppDispatch } => {
   const store = createStore(
      accountReducer,
      applyMiddleware(thunk as ThunkMiddleware<RootState, AppAction>),
   );
   return store;
};

export default configureStore;
