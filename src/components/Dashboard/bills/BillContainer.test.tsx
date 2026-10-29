import { createRootState } from '../../../testing/fixtures';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { useAppSelector as useSelector } from '../../../Redux/hooks';
import BillContainer from './BillContainer';

jest.mock('../../../Redux/hooks', () => ({ useAppSelector: jest.fn() }));
jest.mock('./BillList', () => ({ __esModule: true, default: ({ searchResult }: {searchResult: { _id: string; invoiceNumber?: string }[]}) => <div data-testid='results'>{searchResult.map(b => b.invoiceNumber).join(',')}</div> }));
jest.mock('./BillingForm', () => () => null);
jest.mock('./InvoiceDrafts', () => () => null);
jest.mock('./SalesPreparation', () => () => null);

test('filters by customer, status and issue dates and resets the view', () => {
    jest.mocked(useSelector).mockImplementation(select => select(createRootState({ customers: [{ _id: 'c', name: 'Acme' }], bills: { bills: [
        { _id: 'one', invoiceNumber: 'BF/1', customer: 'c', date: '2026-04-01', total: 100, payments: [] },
        { _id: 'two', invoiceNumber: 'BF/2', customer: 'c', date: '2026-05-01', total: 100, payments: [{ _id: 'p', date: '2026-05-01', method: 'Cash', amount: 100 }] }
    ] } })));
    render(<MemoryRouter><BillContainer /></MemoryRouter>);
    expect(screen.getByTestId('results')).toHaveTextContent('BF/2,BF/1');
    fireEvent.click(screen.getByRole('button', { name: /^Paid/ }));
    expect(screen.getByTestId('results')).toHaveTextContent('BF/2');
    fireEvent.change(screen.getByLabelText('Issued from'), { target: { value: '2026-06-01' } });
    expect(screen.getByText('No invoices match this view')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Issued through'), { target: { value: '2026-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('start date');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('results')).toHaveTextContent('BF/2,BF/1');
    fireEvent.change(screen.getByLabelText('Customer or invoice number'), { target: { value: 'missing' } });
    expect(screen.queryByTestId('results')).not.toBeInTheDocument();
});
