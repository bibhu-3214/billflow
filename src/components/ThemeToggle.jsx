import React from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Brightness4RoundedIcon from '@material-ui/icons/Brightness4Rounded';
import WbSunnyRoundedIcon from '@material-ui/icons/WbSunnyRounded';
import { useAppearance } from '../AppearanceProvider';

export default function ThemeToggle() {
    const { mode, toggleMode } = useAppearance();
    const label = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`;
    return <Tooltip title={label} arrow><button type='button' className='theme-toggle' aria-label={label} aria-pressed={mode === 'dark'} onClick={toggleMode}>{mode === 'dark' ? <WbSunnyRoundedIcon /> : <Brightness4RoundedIcon />}</button></Tooltip>;
}
