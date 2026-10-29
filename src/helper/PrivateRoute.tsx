import type { ComponentType } from 'react';
import type { RouteComponentProps, RouteProps } from 'react-router-dom';
import { Route, Redirect } from 'react-router-dom';
import localData from '../data/localData';
const PrivateRoute = <Params extends { [key: string]: string | undefined } = {}>({ component: Component, ...rest }: Omit<RouteProps, 'component'> & { component: ComponentType<RouteComponentProps<Params>> }) => {
    return (
        <Route
            {...rest}
            render={props => {
                return localData.hasActiveSession() ? (
                    <Component {...props as RouteComponentProps<Params>} />
                ) : (
                    <Redirect to={{ pathname: '/login' }} />
                );
            }}
        />
    );
};
export default PrivateRoute;
