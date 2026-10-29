import type { PropsWithChildren } from 'react';
import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

export const APPEARANCE_KEY = 'billflow.appearance';
const AppearanceContext = createContext({ mode: 'light' as 'light' | 'dark', toggleMode: () => {} });
const validPreference = (value: unknown): 'light' | 'dark' | null => value === 'dark' || value === 'light' ? value : null;
const readPreference = () => {
    try { return validPreference(window.localStorage.getItem(APPEARANCE_KEY)); }
    catch { return null; }
};
const readSystemMode = (): 'dark' | 'light' => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';

export const useAppearance = () => useContext(AppearanceContext);

export default function AppearanceProvider({ children }: PropsWithChildren<{}>) {
    const [preference, setPreference] = useState(readPreference);
    const [systemMode, setSystemMode] = useState(readSystemMode);
    const mode = preference || systemMode;

    useLayoutEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
    useEffect(() => {
        const query = window.matchMedia?.('(prefers-color-scheme: dark)');
        const changed = (event: MediaQueryListEvent) => setSystemMode(event.matches ? 'dark' : 'light');
        if (query?.addEventListener) query.addEventListener('change', changed);
        else query?.addListener?.(changed);
        const storageChanged = (event: StorageEvent) => {
            if (event.key === APPEARANCE_KEY || event.key === null) setPreference(readPreference());
        };
        window.addEventListener('storage', storageChanged);
        return () => {
            if (query?.removeEventListener) query.removeEventListener('change', changed);
            else query?.removeListener?.(changed);
            window.removeEventListener('storage', storageChanged);
        };
    }, []);
    const toggleMode = () => {
        const next = mode === 'dark' ? 'light' : 'dark';
        setPreference(next);
        try { window.localStorage.setItem(APPEARANCE_KEY, next); }
        catch { /* The preference still works for this session when storage is unavailable. */ }
    };
    return <AppearanceContext.Provider value={{ mode, toggleMode }}>{children}</AppearanceContext.Provider>;
}
