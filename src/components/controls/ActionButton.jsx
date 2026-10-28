import React from 'react';
import { IconButton, Tooltip } from '@material-ui/core';

export default function ActionButton(props) {
   const { color, children, className = '', ...other } = props;
   const label = props['aria-label'];
   const button = <IconButton type='button' className={`workspace-action workspace-action-${color === 'secondary' ? 'danger' : 'primary'} ${className}`} {...other}>{children}</IconButton>;

   return (
      label ? <Tooltip title={label} arrow>{other.disabled ? <span style={{ display: 'inline-flex' }}>{button}</span> : button}</Tooltip> : button
   );
}
