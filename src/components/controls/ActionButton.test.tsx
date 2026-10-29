import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActionButton from './ActionButton';

test('record actions retain their accessible name, type and click handler', () => {
    const onClick = jest.fn();
    render(<ActionButton color='primary' aria-label='Edit Asha Traders' onClick={onClick}><svg aria-hidden='true' /></ActionButton>);
    const action = screen.getByRole('button', { name: 'Edit Asha Traders' });
    expect(action).toHaveAttribute('type', 'button');
    expect(action).toHaveClass('workspace-action', 'workspace-action-primary');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
});

test('destructive actions keep a separate tone and respect disabled state', () => {
    const onClick = jest.fn();
    render(<ActionButton color='secondary' className='custom-action' aria-label='Delete product' disabled onClick={onClick}><svg aria-hidden='true' /></ActionButton>);
    const action = screen.getByRole('button', { name: 'Delete product' });
    expect(action).toHaveClass('workspace-action-danger', 'custom-action');
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(onClick).not.toHaveBeenCalled();
});
