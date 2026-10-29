import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useHistory } from 'react-router-dom';
import RouteScrollReset from './RouteScrollReset';

test('resets a new page to the top without jumping on query-only changes', () => {
    const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    function Navigation() {
        const history = useHistory();
        return <><RouteScrollReset /><button onClick={() => history.push('/customer?filter=open')}>Filter</button><button onClick={() => history.push('/billing')}>Invoices</button></>;
    }
    try {
        render(<MemoryRouter initialEntries={['/customer']}><Navigation /></MemoryRouter>);
        expect(scroll).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
        expect(scroll).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Invoices' }));
        expect(scroll).toHaveBeenCalledTimes(2);
        expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' });
    } finally {
        scroll.mockRestore();
    }
});
