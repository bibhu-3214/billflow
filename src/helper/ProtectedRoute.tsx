import type { ComponentType } from 'react';
import type { RouteComponentProps, RouteProps } from 'react-router-dom';
import { Route, Redirect } from 'react-router-dom';
import localData from '../data/localData';
const PrivateRoute = ({ component: Component, ...rest }: Omit<RouteProps, 'component'> & { component: ComponentType<RouteComponentProps> }) => {
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
