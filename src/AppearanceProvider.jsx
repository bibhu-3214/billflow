import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@material-ui/core';
import { createAppTheme } from './theme';

export const APPEARANCE_KEY = 'billflow.appearance';
const AppearanceContext = createContext({ mode: 'light', toggleMode: () => {} });
const validPreference = value => value === 'dark' || value === 'light' ? value : null;
const readPreference = () => {
    try { return validPreference(window.localStorage.getItem(APPEARANCE_KEY)); }
    catch { return null; }
};
const readSystemMode = () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';

export const useAppearance = () => useContext(AppearanceContext);

export default function AppearanceProvider({ children }) {
    const [preference, setPreference] = useState(readPreference);
    const [systemMode, setSystemMode] = useState(readSystemMode);
    const mode = preference || systemMode;
    const theme = useMemo(() => createAppTheme(mode), [mode]);

    useLayoutEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
    useEffect(() => {
        const query = window.matchMedia?.('(prefers-color-scheme: dark)');
        const changed = event => setSystemMode(event.matches ? 'dark' : 'light');
        if (query?.addEventListener) query.addEventListener('change', changed);
        else query?.addListener?.(changed);
        const storageChanged = event => {
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
    return <AppearanceContext.Provider value={{ mode, toggleMode }}><ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider></AppearanceContext.Provider>;
}
