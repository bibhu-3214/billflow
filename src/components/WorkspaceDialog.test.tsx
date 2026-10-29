import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceDialog from './WorkspaceDialog';
import type { DialogSize } from './WorkspaceDialog';
import { TextField } from './ui/primitives';

test.each([false, true])('fields keep their full accessible label on pages and dialogs (%s)', inDialog => {
    const label = 'Internal preparation notes with a longer description';
    const field = <TextField id='bounded-label' label={label} helperText='Only visible to your business' />;
    render(inDialog ? <WorkspaceDialog open aria-label='Label fixture'>{field}</WorkspaceDialog> : field);
    const input = screen.getByRole('textbox', {name: label});
    expect(screen.getByText(label, {selector: 'label'})).toHaveClass('truncate', 'max-w-full');
    expect(input).toHaveAccessibleDescription('Only visible to your business');
    fireEvent.change(input, {target: {value: 'Customer notes'}});
    expect(input).toHaveValue('Customer notes');
    expect(input).toHaveAccessibleName(label);
});
test.each<DialogSize>(['standard', 'editor', 'invoice', 'document', 'operations', 'compact'])('uses bounded %s sizing and modal semantics', size => {
    render(<WorkspaceDialog open size={size} className='custom-dialog' aria-label='Sizing fixture'><p>Dialog content</p></WorkspaceDialog>);
    const panel = screen.getByRole('dialog', {name: 'Sizing fixture'});
    expect(panel).toHaveClass(`workspace-dialog-${size}`, 'custom-dialog', 'w-full', 'min-w-0');
    expect(panel).toHaveAttribute('aria-modal', 'true');
});
test('Escape requests dismissal through the guarded dialog callback', () => {
    const onClose = jest.fn();
    render(<WorkspaceDialog open onClose={onClose} aria-label='Sizing fixture'><p>Dialog content</p></WorkspaceDialog>);
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', keyCode: 27});
    expect(onClose).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown');
});
test('closed dialogs unmount private content', () => {
    render(<WorkspaceDialog open={false} aria-label='Closed fixture'><p>Private content</p></WorkspaceDialog>);
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
});
test('validation messages are associated with their input', () => {
    render(<TextField label='Customer email' error helperText='Enter a valid email' />);
    const input = screen.getByRole('textbox', {name: 'Customer email'});
    expect(input).toHaveAttribute('aria-invalid','true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
});
