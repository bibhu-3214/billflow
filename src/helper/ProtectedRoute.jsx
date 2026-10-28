import { Route, Redirect } from 'react-router-dom';
import localData from '../data/localData';
const PrivateRoute = ({ component: Component, ...rest }) => {
    return (
        <Route
            {...rest}
            render={props => {
                return !localData.hasActiveSession() ? (
                    <Component {...props} />
                ) : (
                    <Redirect to={{ pathname: '/admin' }} />
                );
            }}
        />
    );
};
export default PrivateRoute;
