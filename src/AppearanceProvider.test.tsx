import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppearanceProvider, { APPEARANCE_KEY } from './AppearanceProvider';
import ThemeToggle from './components/ThemeToggle';

type MediaListener = (event: Pick<MediaQueryListEvent, 'matches'>) => void;
let media: {matches: boolean; addEventListener: jest.Mock<Set<MediaListener>, [string, MediaListener]>; removeEventListener: jest.Mock<boolean, [string, MediaListener]>};
let listeners: Set<(event: Pick<MediaQueryListEvent, 'matches'>) => void>;
const setup = () => render(<AppearanceProvider><ThemeToggle /></AppearanceProvider>);
beforeEach(() => {
    localStorage.clear();
    listeners = new Set();
    media = { matches: false, addEventListener: jest.fn((name, callback) => listeners.add(callback)), removeEventListener: jest.fn((name, callback) => listeners.delete(callback)) };
    window.matchMedia = jest.fn(() => media as unknown as MediaQueryList);
});
afterEach(() => { jest.restoreAllMocks(); document.documentElement.removeAttribute('data-theme'); });

test('defaults to the system appearance and follows changes until manually chosen', () => {
    setup();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    act(() => listeners.forEach(listener => listener({ matches: true })));
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    act(() => listeners.forEach(listener => listener({ matches: true })));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

test('stored preference overrides system theme and toggling persists through remount', () => {
    media.matches = true;
    localStorage.setItem(APPEARANCE_KEY, 'light');
    const view = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    view.unmount();
    setup();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('invalid stored preference falls back to the system mode', () => {
    media.matches = true;
    localStorage.setItem(APPEARANCE_KEY, 'unexpected');
    setup();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('storage failures do not stop the toggle from working', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('cross-tab preferences synchronize and listeners are cleaned up', () => {
    const view = setup();
    localStorage.setItem(APPEARANCE_KEY, 'dark');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY })); });
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    view.unmount();
    expect(listeners.size).toBe(0);
});
