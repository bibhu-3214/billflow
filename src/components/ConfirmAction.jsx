import React from 'react';
import { DialogTitle, DialogContent, DialogActions, Button } from '@material-ui/core';
import DeleteOutlineRoundedIcon from '@material-ui/icons/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@material-ui/icons/CheckCircleOutlineRounded';
import WorkspaceDialog from './WorkspaceDialog';

export default function ConfirmAction({ confirmDialog, setConfirmDialog }) {
    const close = () => setConfirmDialog({ ...confirmDialog, isOpen: false });
    return <WorkspaceDialog size='compact' open={confirmDialog.isOpen} onClose={close} aria-labelledby='confirm-action-title' className='confirmation-dialog'>
        <DialogTitle id='confirm-action-title'><span className='confirm-symbol'>{confirmDialog.confirmText ? <CheckCircleOutlineRoundedIcon /> : <DeleteOutlineRoundedIcon />}</span>{confirmDialog.title || 'Delete this record?'}</DialogTitle>
        <DialogContent><p>{confirmDialog.subTitle || 'This permanently removes the record from this workspace. Records referenced by invoices cannot be deleted.'}</p></DialogContent>
        <DialogActions><Button onClick={close}>{confirmDialog.cancelText || 'Keep record'}</Button><Button variant='contained' color={confirmDialog.confirmText ? 'primary' : 'secondary'} onClick={confirmDialog.onConfirm}>{confirmDialog.confirmText || 'Delete record'}</Button></DialogActions>
    </WorkspaceDialog>;
}
