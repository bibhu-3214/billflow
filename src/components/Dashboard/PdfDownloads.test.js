import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceDocument from './bills/InvoiceDocument';
import CustomerStatement from './customers/CustomerStatement';
import { downloadInvoicePdf, downloadStatementPdf } from '../../utils/pdfDocuments';

const mockCustomer = { _id: 'c', name: 'Sample customer' };
const mockBill = { _id: 'b', customer: 'c', invoiceNumber: 'BF/2627/000001', date: '2026-10-14', total: 10, lineItems: [], creditNote: { number: 'CN/2627/000001', amount: 10, taxable: 10, date: '2026-10-14', reason: 'Return', actor: 'Sample' } };
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn(), useSelector: fn => fn({ products: [], customers: [mockCustomer], bills: { bills: [mockBill] } }) }));
jest.mock('../../utils/pdfDocuments', () => ({ downloadInvoicePdf: jest.fn(), downloadStatementPdf: jest.fn() }));
jest.mock('../../data/localData', () => ({ getSettings: () => Promise.resolve({ name: 'Sample business' }) }));

beforeEach(() => jest.clearAllMocks());

test('invoice and credit buttons directly download the requested record and expose failures', async () => {
    downloadInvoicePdf.mockResolvedValueOnce().mockRejectedValueOnce(new Error('PDF fonts could not load.'));
    render(<InvoiceDocument bill={mockBill} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF', exact: true }));
    await waitFor(() => expect(downloadInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ bill: mockBill, credit: false })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download credit note PDF' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Download credit note PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF fonts could not load.');
    expect(downloadInvoicePdf).toHaveBeenLastCalledWith(expect.objectContaining({ bill: mockBill, credit: true }));
});

test('statement button exports the selected customer with loaded business records', async () => {
    downloadStatementPdf.mockResolvedValueOnce();
    render(<MemoryRouter initialEntries={['/statement?customer=c']}><CustomerStatement /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Download statement PDF' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(downloadStatementPdf).toHaveBeenCalledWith({ bills: [mockBill], customer: mockCustomer, business: { name: 'Sample business' } }));
});
