import React from 'react';
import { Dialog } from '@material-ui/core';

// Dialogs own their width; their children fill the available content area.
// Size by the content's task, never by a child's viewport-based minimum width.
export default function WorkspaceDialog({ size = 'standard', className = '', ...props }) {
    return <Dialog {...props} maxWidth={false} fullWidth className={`workspace-dialog workspace-dialog-${size} ${className}`} />;
}
