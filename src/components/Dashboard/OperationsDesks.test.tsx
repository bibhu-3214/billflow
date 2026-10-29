import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StockDesk, { StockEditor } from './StockDesk';
import FollowUpDesk, { FollowUpEditor } from './FollowUpDesk';
import localData from '../../data/localData';
import { today } from '../../utils/indiaBilling';
jest.mock('react-redux', () => ({ useSelector: (selector: (state: object) => unknown) => selector({ products: [{ _id: 'p', name: 'Carton bundle', unit: 'BOX', sku: 'BOX-01' }, { _id: 'q', name: 'Packing tape', unit: 'NOS' }], customers: [{ _id: 'c', name: 'Trade buyer' }, { _id: 'other', name: 'Other buyer' }] }) }));
jest.mock('../../data/localData', () => ({ __esModule: true, default: { getStockRecords: jest.fn(), recordStockMovement: jest.fn(), getFollowUps: jest.fn(), saveFollowUp: jest.fn(), setFollowUpStatus: jest.fn() } }));
const record: import('../../types/domain').StockRecord = { product: 'p', name: 'Carton bundle', unit: 'BOX', onHand: 2, reorderLevel: 3, revision: 1, movements: [{ type: 'opening', delta: 2, balance: 2, reorderLevel: 3, reason: 'Counted', at: new Date().toISOString() }] };
const task: import('../../types/domain').FollowUp = { _id: 'f', customer: 'c', customerName: 'Trade buyer', title: 'Confirm payment conversation', dueDate: today(), channel: 'Phone', purpose: 'Collection', priority: 'High', status: 'open', revision: 1, history: [{ action: 'created', at: new Date().toISOString(), dueDate: today() }] };
beforeEach(() => { jest.mocked(localData.getStockRecords).mockResolvedValue([record]); jest.mocked(localData.getFollowUps).mockResolvedValue([task]); });

test('stock desk distinguishes unknown stock, low counts and actionable load failures', async () => {
    jest.mocked(localData.getStockRecords).mockRejectedValueOnce(new Error('Cannot decrypt')).mockResolvedValue([record]);
    render(<StockDesk />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot decrypt');
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload stock' }));
    expect(await screen.findByText('Low stock')).toBeInTheDocument(); expect(screen.getByText('Unknown')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find product or SKU'), { target: { value: 'BOX-01' } });
    expect(screen.getByText('Carton bundle')).toBeInTheDocument(); expect(screen.queryByText('Packing tape')).not.toBeInTheDocument();
});
test('stock save failures retain values and save only closes on success', async () => {
    jest.mocked(localData.recordStockMovement).mockRejectedValueOnce(new Error('Stock changed')).mockResolvedValue(record);
    const close = jest.fn(), saved = jest.fn();
    render(<StockEditor product={{ price: 100, _id: 'p', name: 'Carton bundle', unit: 'BOX' }} record={record} onClose={close} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText(/Change in units/), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText(/Count \/ adjustment reason/), { target: { value: 'Damaged' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record stock movement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stock changed'); expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Change in units/)).toHaveValue(-1);
    fireEvent.click(screen.getByRole('button', { name: 'Record stock movement' }));
    await waitFor(() => expect(close).toHaveBeenCalled()); expect(localData.recordStockMovement).toHaveBeenCalledWith(expect.objectContaining({ product: 'p', revision: 1, delta: '-1', reason: 'Damaged' }));
});
test('collection desk scopes tasks by purpose and customer, retaining completed history', async () => {
    jest.mocked(localData.getFollowUps).mockResolvedValue([task, { ...task, _id: 'a', purpose: 'Order enquiry', title: 'Order enquiry' }, { ...task, _id: 'b', customer: 'other', title: 'Other conversation' }, { ...task, _id: 'done', status: 'completed', title: 'Previous conversation' }]);
    render(<FollowUpDesk collectionsOnly customerId='c' />);
    await screen.findByText('Confirm payment conversation');
    expect(screen.queryByText('Other conversation')).not.toBeInTheDocument(); expect(screen.queryByText('Order enquiry')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('Previous conversation')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Reopen Previous conversation' })).toBeInTheDocument();
});
test('outcome failures retain notes and expected revision; no messages are sent', async () => {
    jest.mocked(localData.setFollowUpStatus).mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue(task);
    const close = jest.fn(); render(<FollowUpEditor record={task} transition='completed' onSaved={jest.fn()} onClose={close} />);
    fireEvent.change(screen.getByLabelText(/Outcome \/ next steps/), { target: { value: 'Buyer requested a call tomorrow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete follow-up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full'); expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Outcome \/ next steps/)).toHaveValue('Buyer requested a call tomorrow');
    fireEvent.click(screen.getByRole('button', { name: 'Complete follow-up' }));
    await waitFor(() => expect(close).toHaveBeenCalled()); expect(localData.setFollowUpStatus).toHaveBeenCalledWith('f', 1, 'completed', 'Buyer requested a call tomorrow');
});
test('follow-up load failures do not masquerade as an empty action queue', async () => {
    jest.mocked(localData.getFollowUps).mockRejectedValueOnce(new Error('Session expired')).mockResolvedValue([]);
    render(<FollowUpDesk />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired');
    expect(screen.queryByText('A clear next action makes relationships stronger.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload follow-ups' }));
    expect(await screen.findByText('A clear next action makes relationships stronger.')).toBeInTheDocument();
});
