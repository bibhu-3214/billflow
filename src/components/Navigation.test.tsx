import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import Navigation from './Navigation';
import { logout } from '../Redux/Actions/usersAction';
import alerts from '../utils/alerts';

jest.mock('../Redux/Actions/usersAction', () => ({ logout: jest.fn(() => ({ type: 'LOGOUT' })) }));
jest.mock('../utils/alerts', () => ({ fire: jest.fn() }));
jest.mock('./WorkspaceSearch', () => () => <button aria-label='Search workspace (Control or Command K)'>Search</button>);

const setup = (isLoggedIn = true, details = {}, path = '/product') => {
    const history = createMemoryHistory({ initialEntries: [path] });
    const store = createStore((state = { users: { isLoggedIn, userDetails: details } }, action) => action.type === 'LOGOUT' ? { users: { isLoggedIn: false, userDetails: {} } } : state);
    render(<Provider store={store}><Router history={history}><Navigation /></Router></Provider>);
    return { history, store };
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(logout).mockImplementation(() => ({ type: 'LOGOUT' }));
});

test('separates workspace identity, utilities and labelled primary navigation', () => {
    setup(true, { username: 'Asha', businessName: 'Asha Traders', isDemo: true });
    expect(screen.getByText('Asha Traders')).toBeInTheDocument();
    expect(screen.getByText('Sample workspace')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Asha Business settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search workspace/ })).toBeInTheDocument();
});

test('uses honest local-workspace and account fallbacks', () => {
    setup();
    expect(screen.getByText('Your workspace')).toBeInTheDocument();
    expect(screen.getByText('Local workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Business owner Business settings' })).toBeInTheDocument();
});

test('public header provides sign-in and registration without private utilities', () => {
    setup(false, {}, '/login');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search workspace/ })).not.toBeInTheDocument();
});

test('dedicated sign-out retains session logout and redirects home', () => {
    const { history, store } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect((store.getState() as {users: {isLoggedIn: boolean}}).users.isLoggedIn).toBe(false);
    expect(history.location.pathname).toBe('/');
    expect(alerts.fire).toHaveBeenCalledWith('Signed out', expect.any(String), 'success');
});
