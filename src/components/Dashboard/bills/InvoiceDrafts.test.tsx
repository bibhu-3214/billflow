import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoiceDrafts from './InvoiceDrafts';
import localData from '../../../data/localData';

jest.mock('react-redux', () => ({ useSelector: (selector: (state: object) => unknown) => selector({ customers: [{ _id: 'c', name: 'Retail buyer' }] }) }));
jest.mock('../../../data/localData', () => ({ __esModule: true, default: { getInvoiceDrafts: jest.fn(), duplicateInvoiceDraft: jest.fn(), removeInvoiceDraft: jest.fn() } }));
const draft = { _id: 'd', revision: 2, title: 'Counter order', customer: 'c', date: '2026-10-09', updatedAt: '2026-10-09T08:00:00Z', gst: false, lineItems: [] };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(localData.getInvoiceDrafts).mockResolvedValue([draft]); });

test('finds and resumes saved work without treating incomplete amounts as receivables', async () => {
    const resume = jest.fn();
    render(<InvoiceDrafts onResume={resume} />);
    expect(await screen.findByText('Counter order')).toBeInTheDocument();
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find a draft or customer'), { target: { value: 'missing' } });
    expect(screen.getByText('No drafts match your search.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find a draft or customer'), { target: { value: 'Retail buyer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resume Counter order' }));
    expect(resume).toHaveBeenCalledWith(draft);
});

test('deleting requires explicit confirmation and failed deletion leaves the draft visible', async () => {
    jest.mocked(localData.removeInvoiceDraft).mockRejectedValue(new Error('Revision conflict'));
    render(<InvoiceDrafts onResume={jest.fn()} />);
    await screen.findByText('Counter order');
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft Counter order' }));
    expect(screen.getByRole('dialog', { name: 'Delete this draft?' })).toBeInTheDocument();
    expect(localData.removeInvoiceDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Revision conflict');
    expect(screen.getByText('Counter order')).toBeInTheDocument();
    expect(localData.removeInvoiceDraft).toHaveBeenCalledWith('d', 2);
});

test('load failures are actionable instead of appearing as an empty workspace', async () => {
    jest.mocked(localData.getInvoiceDrafts).mockRejectedValueOnce(new Error('Unable to decrypt drafts')).mockResolvedValueOnce([]);
    render(<InvoiceDrafts onResume={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to decrypt drafts');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('A place for orders still taking shape.')).toBeInTheDocument();
});

test('duplicates through the data layer and refreshes the visible list', async () => {
    jest.mocked(localData.duplicateInvoiceDraft).mockResolvedValue({ ...draft, _id: 'copy' });
    render(<InvoiceDrafts onResume={jest.fn()} />);
    await screen.findByText('Counter order');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Counter order' }));
    await waitFor(() => expect(localData.getInvoiceDrafts).toHaveBeenCalledTimes(2));
    expect(localData.duplicateInvoiceDraft).toHaveBeenCalledWith('d', 2);
    expect(screen.getByRole('status')).toHaveTextContent('Draft duplicated');
});

test('refreshes the saved revision before an editor is reopened', async () => {
    const resume = jest.fn();
    const { rerender } = render(<InvoiceDrafts refreshKey={0} onResume={resume} />);
    await screen.findByText('Counter order');
    jest.mocked(localData.getInvoiceDrafts).mockResolvedValue([{ ...draft, revision: 3, title: 'Updated order' }]);
    rerender(<InvoiceDrafts refreshKey={1} onResume={resume} />);
    await screen.findByText('Updated order');
    fireEvent.click(screen.getByRole('button', { name: 'Resume Updated order' }));
    expect(resume).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
});

test('paginates larger draft shelves and resets pagination when searching', async () => {
    jest.mocked(localData.getInvoiceDrafts).mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({ ...draft, _id: 'd' + index, title: 'Order ' + (index + 1) })));
    render(<InvoiceDrafts onResume={jest.fn()} />);
    await screen.findByText('Order 1');
    expect(screen.queryByText('Order 7')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next drafts' }));
    expect(screen.getByText('Order 7')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find a draft or customer'), { target: { value: 'Order 1' } });
    expect(screen.getByText('Order 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next drafts' })).not.toBeInTheDocument();
});
