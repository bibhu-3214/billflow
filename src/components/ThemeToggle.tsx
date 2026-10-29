import { ui } from '../styles/ui';
import { Moon as Brightness4RoundedIcon, Sun as WbSunnyRoundedIcon } from 'lucide-react';
import { Tooltip } from './ui/primitives';
import React from 'react';

import { useAppearance } from '../AppearanceProvider';

export default function ThemeToggle() {
    const { mode, toggleMode } = useAppearance();
    const label = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`;
    return <Tooltip title={label} arrow><button type='button' className={ui("theme-toggle")} aria-label={label} aria-pressed={mode === 'dark'} onClick={toggleMode}>{mode === 'dark' ? <WbSunnyRoundedIcon /> : <Brightness4RoundedIcon />}</button></Tooltip>;
}
