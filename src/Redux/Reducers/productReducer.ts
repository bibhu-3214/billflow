import type { AppAction, RootState } from '../types';
import { ADD_PRODUCT, EDIT_PRODUCT, GET_PRODUCTS, REMOVE_PRODUCT } from '../actionTypes';

const productsInitialState: RootState['products'] = [];

const productsReducer = (state: RootState['products'] = productsInitialState, action: AppAction) => {
   switch (action.type) {
      case ADD_PRODUCT: {
         return [...state, action.payload];
      }
      case GET_PRODUCTS: {
         return [...action.payload];
      }
      case REMOVE_PRODUCT: {
         return state.filter((ele) => ele._id !== action.payload._id);
      }
      case EDIT_PRODUCT: {
         return state.map((ele) => {
            if (ele._id === action.payload._id) {
               return { ...action.payload };
            } else {
               return ele;
            }
         });
      }
      default: {
         return state;
      }
   }
};

export default productsReducer;
