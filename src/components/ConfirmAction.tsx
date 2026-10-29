import { ui } from '../styles/ui';
import { Trash2 as DeleteOutlineRoundedIcon, CircleCheck as CheckCircleOutlineRoundedIcon } from 'lucide-react';
import { DialogTitle, DialogContent, DialogActions, Button } from './ui/primitives';
export interface Confirmation { isOpen: boolean; title?: string; subTitle?: string; confirmText?: string; cancelText?: string; onConfirm?: () => unknown }
import React from 'react';

import WorkspaceDialog from './WorkspaceDialog';

export default function ConfirmAction({ confirmDialog, setConfirmDialog }: { confirmDialog: Confirmation; setConfirmDialog: (state: Confirmation) => void }) {
    const close = () => setConfirmDialog({ ...confirmDialog, isOpen: false });
    return <WorkspaceDialog size='compact' open={confirmDialog.isOpen} onClose={close} aria-labelledby='confirm-action-title' className={ui("confirmation-dialog")}>
        <DialogTitle id='confirm-action-title'><span className={ui("confirm-symbol")}>{confirmDialog.confirmText ? <CheckCircleOutlineRoundedIcon /> : <DeleteOutlineRoundedIcon />}</span>{confirmDialog.title || 'Delete this record?'}</DialogTitle>
        <DialogContent><p>{confirmDialog.subTitle || 'This permanently removes the record from this workspace. Records referenced by invoices cannot be deleted.'}</p></DialogContent>
        <DialogActions><Button onClick={close}>{confirmDialog.cancelText || 'Keep record'}</Button><Button variant='contained' color={confirmDialog.confirmText ? 'primary' : 'secondary'} onClick={confirmDialog.onConfirm}>{confirmDialog.confirmText || 'Delete record'}</Button></DialogActions>
    </WorkspaceDialog>;
}
