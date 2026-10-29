import {chooseOption} from '../../../testing/chooseOption';
import { createRootState, draftFixture, quotationFixture, templateFixture, settingsFixture } from '../../../testing/fixtures';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAppDispatch as useDispatch, useAppSelector as useSelector } from '../../../Redux/hooks';
import { addBill } from '../../../Redux/Actions/billAction';
import BillingForm from './BillingForm';
import Popup from '../../Popup';
import localData from '../../../data/localData';

jest.mock('../../../Redux/hooks', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('react-router', () => ({ useHistory: () => ({ push: jest.fn() }) }));
jest.mock('../../../Redux/Actions/billAction', () => ({ addBill: jest.fn(() => ({ type: 'TEST' })) }));
jest.mock('../../../data/localData', () => ({ __esModule: true, default: { getSettings: jest.fn(() => Promise.resolve({ dueDays: 0, gstin: '', state: '', terms: '' })), saveInvoiceDraft: jest.fn(), saveQuotation: jest.fn(), saveInvoiceTemplate: jest.fn() } }));
beforeEach(() => jest.mocked(localData.getSettings).mockResolvedValue(settingsFixture()));

const preparedOrder = () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [{ _id: 'c', name: 'Buyer' }], products: [{ _id: 'p', name: 'Cartons', price: 100 }] })));
    jest.mocked(useDispatch).mockReturnValue(jest.fn());
    return { _id: 'd', revision: 1, title: 'Carton bundle', customer: 'c', date: '2026-10-09', dueDate: '2026-10-24', billingAddress: 'Mumbai', gst: false, supplierGSTIN: '', customerGSTIN: '', supplierState: '', placeOfSupply: '', notes: '', lineItems: [{ product: 'p', name: 'Cartons', price: 100, quantity: 2, discount: 0, unit: 'NOS', hsn: '', gstRate: '' }] };
};
test('quotation save failures retain the offer and never invoke invoice issuance', async () => {
    const draft = preparedOrder(), close = jest.fn(), saved = jest.fn();
    jest.mocked(localData.saveQuotation).mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue(quotationFixture({_id: 'q'}));
    render(<BillingForm quotationMode initialDraft={draft} setOpenPopup={close} onQuotationSaved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save quotation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    expect(close).not.toHaveBeenCalled(); expect(localData.saveInvoiceDraft).not.toHaveBeenCalled(); expect(addBill).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save quotation' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(quotationFixture({_id: 'q'}))); expect(close).toHaveBeenCalledWith(false);
});
test('saving templates leaves the order open and sends only bundle fields', async () => {
    const draft = preparedOrder(), close = jest.fn();
    jest.mocked(localData.saveInvoiceTemplate).mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue(templateFixture({_id: 't'}));
    render(<BillingForm initialDraft={draft} setOpenPopup={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save item template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full'); expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save item template' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Item template saved');
    expect(Object.keys(jest.mocked(localData.saveInvoiceTemplate).mock.calls[0][0]).sort()).toEqual(['lineItems', 'notes', 'title']);
    expect(close).not.toHaveBeenCalled();
});

test('finishing a draft save after unmount does not update state or invoke stale callbacks', async () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [], products: [] })));
    jest.mocked(useDispatch).mockReturnValue(jest.fn());
    let finish!: (value: import('../../../types/domain').Draft) => void;
    jest.mocked(localData.saveInvoiceDraft).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const close = jest.fn(), saved = jest.fn();
    const { unmount } = render(<BillingForm setOpenPopup={close} onDraftSaved={saved} />);
    await waitFor(() => expect(screen.queryByText('Loading business defaults…')).not.toBeInTheDocument());
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
        unmount();
        await act(async () => finish(draftFixture({_id: 'd'})));
        expect(close).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
    } finally { errors.mockRestore(); }
});

test('editor calculates a discounted preview and retains input when issuing does not succeed', async () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [{ _id: 'c', name: 'Buyer', address: 'Saved billing address', state: '27' }], products: [{ _id: 'p', name: 'Consulting', price: 100 }] })));
    jest.mocked(useDispatch).mockReturnValue(jest.fn().mockResolvedValue(undefined));
    const close = jest.fn();
    render(<BillingForm setOpenPopup={close} />);
    expect(screen.getByRole('complementary', { name: 'Invoice review' })).toBeInTheDocument();
    expect(screen.getByText('Your invoice starts with an item.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading business defaults…')).not.toBeInTheDocument());
    chooseOption('Customer',/^Buyer/);
    expect(screen.getByLabelText(/Customer billing/)).toHaveValue('Saved billing address');
    fireEvent.change(screen.getByLabelText(/Customer billing/), { target: { value: 'Mumbai' } });
    chooseOption('Product',/^Consulting/);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByRole('spinbutton', {name: 'Quantity', exact: true}), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Discount %/), { target: { value: '10' } });
    expect(screen.getAllByText('₹180.00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(addBill).toHaveBeenCalled());
    expect(jest.mocked(addBill).mock.calls[0][0]).toMatchObject({ customer: 'c', billingAddress: 'Mumbai', lineItems: [expect.objectContaining({ quantity: '2', discount: '10' })] });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Customer billing/)).toHaveValue('Mumbai');
});

test('saves an incomplete draft without submitting an invoice and closes only on confirmed save', async () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [], products: [] })));
    jest.mocked(useDispatch).mockReturnValue(jest.fn());
    jest.mocked(localData.saveInvoiceDraft).mockRejectedValueOnce(new Error('Storage full')).mockResolvedValueOnce(draftFixture({_id: 'draft'}));
    const close = jest.fn(), saved = jest.fn();
    render(<BillingForm setOpenPopup={close} onDraftSaved={saved} />);
    await waitFor(() => expect(screen.queryByText('Loading business defaults…')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Draft reference (internal only)'), { target: { value: 'Pending order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    expect(close).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Draft reference (internal only)')).toHaveValue('Pending order');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(saved).toHaveBeenCalledWith(draftFixture({_id: 'draft'}));
    expect(localData.saveInvoiceDraft).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Pending order', lineItems: [], customer: '' }), undefined, undefined);
});

test('resumes draft terms, uses current catalog prices with a warning and carries revision into issuance', async () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [{ _id: 'c', name: 'Buyer' }], products: [{ _id: 'p', name: 'New name', price: 200 }] })));
    const dispatch = jest.fn().mockResolvedValue({ ok: false, error: 'Draft changed elsewhere' });
    jest.mocked(useDispatch).mockReturnValue(dispatch);
    const draft = { _id: 'd', revision: 3, title: 'Saved order', customer: 'c', date: '2026-10-09', dueDate: '2026-10-10', billingAddress: 'Saved address', notes: 'Saved terms', gst: false,
        supplierGSTIN: '', customerGSTIN: '', supplierState: '', placeOfSupply: '', lineItems: [{ product: 'p', name: 'Old name', price: 100, quantity: 2, discount: 0, unit: 'NOS' }] };
    const close = jest.fn();
    render(<BillingForm initialDraft={draft} setOpenPopup={close} />);
    expect(screen.getByText(/Catalog prices changed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Notes / payment terms')).toHaveValue('Saved terms');
    fireEvent.click(screen.getByRole('button', { name: 'Net 15' }));
    expect(screen.getByRole('textbox', {name: /Due date/})).toHaveValue('2026-10-24');
    expect(screen.getAllByText('₹400.00')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Draft changed elsewhere');
    expect(jest.mocked(addBill).mock.calls.at(-1)?.[0]).toMatchObject({ draftId: 'd', draftRevision: 3, lineItems: [expect.objectContaining({ price: 200 })] });
    expect(close).not.toHaveBeenCalled();
});

test('select-only invoice edits require confirmation before closing', async () => {
    jest.mocked(useSelector).mockImplementation(selector => selector(createRootState({ customers: [{ _id: 'c', name: 'Buyer', address: 'Saved address' }], products: [] })));
    jest.mocked(useDispatch).mockReturnValue(jest.fn());
    const close = jest.fn();
    render(<Popup title='Invoice studio' size='invoice' openPopup setOpenPopup={close}><BillingForm setOpenPopup={close} /></Popup>);
    await waitFor(() => expect(screen.queryByText('Loading business defaults…')).not.toBeInTheDocument());
    chooseOption('Customer',/^Buyer/);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
});
