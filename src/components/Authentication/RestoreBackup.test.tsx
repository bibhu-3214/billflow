import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import localData from '../../data/browserData';
import RestoreBackup from './RestoreBackup';

jest.mock('../../data/browserData', () => ({ __esModule: true, default: { previewBackup: jest.fn(), restoreBackup: jest.fn() } }));

test('requires verification and explicit confirmation, then clears the password after recovery', async () => {
    jest.mocked(localData.previewBackup).mockResolvedValue({ drafts: 0, quotations: 0, templates: 0, followUps: 0, trackedProducts: 0, businessName: 'Sample shop', email: 'sample@example.test', customers: 2, products: 3, invoices: 4, createdAt: '2026-10-08' });
    jest.mocked(localData.restoreBackup).mockResolvedValue('sample@example.test');
    render(<RestoreBackup />);
    fireEvent.click(screen.getByText('Recover from an encrypted backup'));
    const file = { size: 100, text: () => Promise.resolve('encrypted fixture') };
    fireEvent.change(screen.getByLabelText(/BillFlow backup file/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Backup account password/), { target: { value: 'test password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText('Sample shop');
    expect(localData.restoreBackup).not.toHaveBeenCalled();
    const restore = screen.getByRole('button', { name: 'Restore as a recovered account' });
    expect(restore).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type RESTORE to confirm/), { target: { value: 'RESTORE' } });
    fireEvent.click(restore);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Restored successfully'));
    expect(localData.restoreBackup).toHaveBeenCalledWith('encrypted fixture', 'test password');
    expect(screen.getByLabelText(/Backup account password/)).toHaveValue('');
});

test('shows invalid-password errors without offering restore', async () => {
    jest.mocked(localData.previewBackup).mockRejectedValue(new Error('Unable to unlock backup'));
    render(<RestoreBackup />);
    fireEvent.click(screen.getByText('Recover from an encrypted backup'));
    fireEvent.change(screen.getByLabelText(/BillFlow backup file/), { target: { files: [{ size: 10, text: () => Promise.resolve('bad') }] } });
    fireEvent.change(screen.getByLabelText(/Backup account password/), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unable to unlock backup'));
    expect(screen.queryByLabelText(/Type RESTORE to confirm/)).not.toBeInTheDocument();
});
