import { ui } from '../../styles/ui';
import { type IconButtonProps, IconButton, Tooltip } from '../ui/primitives';

import React from 'react';

export default function ActionButton(props: IconButtonProps) {
   const { color, children, className = '', ...other } = props;
   const label = props['aria-label'];
   const button = <IconButton type='button' className={ui(`workspace-action workspace-action-${color === 'secondary' ? 'danger' : 'primary'} ${className}`)} {...other}>{children}</IconButton>;

   return (
      label ? <Tooltip title={label} arrow>{other.disabled ? <span className={ui("inline-flex")}>{button}</span> : button}</Tooltip> : button
   );
}
