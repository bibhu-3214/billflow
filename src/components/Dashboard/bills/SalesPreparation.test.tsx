import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SalesPreparation, { QuotationReview } from './SalesPreparation';
import localData from '../../../data/localData';
import { useAppDispatch as useDispatch } from '../../../Redux/hooks';
import { today } from '../../../utils/indiaBilling';

jest.mock('../../../Redux/hooks', () => ({ useAppDispatch: jest.fn() }));
jest.mock('react-router-dom', () => ({ useHistory: () => ({ push: jest.fn() }) }));
jest.mock('../../../data/localData', () => ({ __esModule: true, default: { getQuotations: jest.fn(), getInvoiceTemplates: jest.fn(), draftFromTemplate: jest.fn(), removeInvoiceTemplate: jest.fn(), setQuotationStatus: jest.fn() } }));
const quote = { customer: 'c', _id: 'q', revision: 1, title: 'Trade offer', number: 'QT/2627/000001', status: 'open' as const, date: today(), dueDate: today(), gst: false,
    supplierSnapshot: { name: 'Shop', address: 'Mumbai' }, customerSnapshot: { name: 'Buyer', address: 'Mumbai' }, lineItems: [{ name: 'Cartons', product: 'p', price: 100, quantity: 2, discount: 5, unit: 'NOS' }] };
beforeEach(() => { jest.mocked(localData.getQuotations).mockResolvedValue([quote]); jest.mocked(localData.getInvoiceTemplates).mockResolvedValue([{ _id: 't', revision: 1, title: 'Repeat bundle', lineItems: quote.lineItems }]); });
const props = () => ({ onChanged: jest.fn(), onCreateQuotation: jest.fn(), onResumeDraft: jest.fn() });

test('switching preparation tabs never renders template records as quotations', async () => {
    render(<SalesPreparation {...props()} />);
    await screen.findByText('Trade offer');
    fireEvent.click(screen.getByRole('button', { name: 'Item templates' }));
    await screen.findByText('Repeat bundle');
    fireEvent.click(screen.getByRole('button', { name: 'Quotations' }));
    expect(await screen.findByText('Trade offer')).toBeInTheDocument();
    expect(screen.queryByText('Repeat bundle')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quotations' }));
    expect(await screen.findByText('Trade offer')).toBeInTheDocument();
});

test('searches offers and retains records after load failure with actionable recovery', async () => {
    jest.mocked(localData.getQuotations).mockRejectedValueOnce(new Error('Cannot decrypt')).mockResolvedValue([quote]);
    render(<SalesPreparation {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot decrypt');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await screen.findByText('Trade offer');
    fireEvent.change(screen.getByLabelText('Find an offer or customer'), { target: { value: 'unknown' } });
    expect(screen.getByText('No matches in this view.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find an offer or customer'), { target: { value: 'Buyer' } });
    expect(screen.getByRole('button', { name: 'Review Trade offer' })).toBeInTheDocument();
});

test('failed template creation does not open editor; successful creation opens a fresh draft', async () => {
    const callbacks = props(); jest.mocked(localData.draftFromTemplate).mockRejectedValueOnce(new Error('Product unavailable')).mockResolvedValue({ _id: 'fresh', revision: 1, lineItems: [], customer: '' });
    render(<SalesPreparation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Item templates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use Repeat bundle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Product unavailable');
    expect(callbacks.onResumeDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use Repeat bundle' }));
    await waitFor(() => expect(callbacks.onResumeDraft).toHaveBeenCalledWith({ _id: 'fresh', revision: 1, lineItems: [], customer: '' }));
});

test('acceptance requires confirmation and stale status errors preserve the review', async () => {
    jest.mocked(localData.setQuotationStatus).mockRejectedValue(new Error('Quotation changed'));
    const close = jest.fn(); render(<QuotationReview quote={quote} onChanged={jest.fn()} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record acceptance' }));
    expect(localData.setQuotationStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Record acceptance?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quotation changed');
    expect(close).not.toHaveBeenCalled();
    expect(localData.setQuotationStatus).toHaveBeenCalledWith('q', 1, 'accepted');
});

test('conversion errors retain dates and converted offers cannot be converted again', async () => {
    jest.mocked(useDispatch).mockReturnValue(jest.fn().mockResolvedValue({ ok: false, error: 'Storage full' }));
    const close = jest.fn(); const { rerender } = render(<QuotationReview quote={{ ...quote, status: 'accepted' }} onChanged={jest.fn()} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Issue linked invoice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    expect(screen.getByRole('textbox', {name: /Payment due date/})).toHaveValue(today()); expect(close).not.toHaveBeenCalled();
    rerender(<QuotationReview quote={{ ...quote, status: 'converted' }} onChanged={jest.fn()} onClose={close} />);
    expect(screen.queryByRole('button', { name: 'Issue linked invoice' })).not.toBeInTheDocument();
});
