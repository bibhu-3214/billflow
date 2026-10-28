import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import customersReducer from './Reducers/customersReducer';
import userReducer from './Reducers/userReducer';
import productReducer from './Reducers/productReducer';
import billReducer from './Reducers/billReducer';
import { LOGOUT } from './actionTypes';

const reducers = combineReducers({ users: userReducer, customers: customersReducer,
   products: productReducer, bills: billReducer });
const accountReducer = (state, action) => reducers(action.type === LOGOUT ? undefined : state, action);

const configureStore = () => {
   const store = createStore(
      accountReducer,
      applyMiddleware(thunk),
   );
   return store;
};

export default configureStore;
