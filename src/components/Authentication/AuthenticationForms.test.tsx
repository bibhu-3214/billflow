import { createMemoryHistory } from 'history';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import Register from './Register';

jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('../../data/localData', () => ({ __esModule: true, default: {} }));

test.each([
    ['sign-in', Login, ['Work email', 'Password']],
    ['registration', Register, ['Your name', 'Work email', 'Password', 'Business name', 'Business address']],
])('%s fields have accessible labels', (name, Form, labels) => {
    render(<MemoryRouter><Form history={createMemoryHistory()} /></MemoryRouter>);
    labels.forEach(label => expect(screen.getByLabelText(label)).toBeInTheDocument());
});
