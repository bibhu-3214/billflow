import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import AlertHost from './AlertHost';
import alerts from '../utils/alerts';

test('notifications wait for acknowledgement and preserve queued errors', async () => {
    render(<AlertHost />);
    let first!: ReturnType<typeof alerts.fire>, second!: ReturnType<typeof alerts.fire>;
    const acknowledged = jest.fn();
    act(() => {
        first = alerts.fire('Workspace ready', 'Your records are available.', 'success');
        second = alerts.fire('Save failed', '<script>private text</script>', 'error');
        void first.then(acknowledged);
    });
    expect(screen.getByRole('dialog', {name: 'Workspace ready'})).toBeInTheDocument();
    expect(acknowledged).not.toHaveBeenCalled();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'OK'})); await first;});
    expect(acknowledged).toHaveBeenCalledWith({isConfirmed:true});
    const error = screen.getByRole('dialog', {name:'Save failed'});
    expect(error).toHaveTextContent('<script>private text</script>');
    expect(error.querySelector('script')).toBeNull();
    await act(async () => {fireEvent.keyDown(error, {key:'Escape', keyCode:27}); await second;});
    await expect(second).resolves.toEqual({isConfirmed:false});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
