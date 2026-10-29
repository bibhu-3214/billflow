import { ui } from '../styles/ui';
import { X as CloseIcon } from 'lucide-react';
import { DialogTitle, DialogContent, DialogActions, Button, IconButton } from './ui/primitives';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { DialogSize } from './WorkspaceDialog';
import React, { createContext, useContext, useEffect, useState } from 'react';

import WorkspaceDialog from './WorkspaceDialog';

const PopupContext = createContext<{ setDirty: Dispatch<SetStateAction<boolean>>; setBusy: Dispatch<SetStateAction<boolean>>; close: () => void } | null>(null);
let popupSequence = 0;
export function usePopupForm(dirty: boolean, busy: boolean) {
    const context = useContext(PopupContext);
    const setDirty = context?.setDirty;
    const setBusy = context?.setBusy;
    useEffect(() => { setDirty?.(dirty); return () => setDirty?.(false); }, [dirty, setDirty]);
    useEffect(() => { setBusy?.(busy); return () => setBusy?.(false); }, [busy, setBusy]);
    return context?.close;
}

export default function Popup({ children, openPopup, setOpenPopup, title = 'Workspace details', size = 'standard' }: { children?: ReactNode; openPopup: boolean; setOpenPopup: (open: boolean) => void; title?: string; size?: DialogSize }) {
    const [titleId] = useState(() => `workspace-popup-title-${++popupSequence}`);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const close = () => { if (!busy) { if (dirty) setConfirm(true); else setOpenPopup(false); } };
    useEffect(() => { if (!openPopup) { setConfirm(false); setDirty(false); setBusy(false); } }, [openPopup]);
    return <PopupContext.Provider value={{ setDirty, setBusy, close }}>
        <WorkspaceDialog open={openPopup} size={size} className={ui("studio-dialog")} aria-labelledby={titleId} onClose={close}>
            <DialogTitle disableTypography className={ui("studio-dialog-title")}><div><span className={ui("dialog-eyebrow")}>BILLFLOW WORKSPACE</span><h2 id={titleId}>{title || 'Workspace details'}</h2></div><IconButton aria-label='Close dialog' disabled={busy} onClick={close}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent className={ui("studio-dialog-content")}>{children}</DialogContent>
        </WorkspaceDialog>
        <WorkspaceDialog size='compact' open={confirm && openPopup} onClose={() => setConfirm(false)} aria-labelledby='discard-title'><DialogTitle id='discard-title'>Discard unsaved changes?</DialogTitle><DialogContent>Your changes have not been saved. Keep editing to finish this record.</DialogContent><DialogActions><Button onClick={() => setConfirm(false)} color='primary'>Keep editing</Button><Button onClick={() => { setConfirm(false); setOpenPopup(false); }} color='secondary'>Discard changes</Button></DialogActions></WorkspaceDialog>
    </PopupContext.Provider>;
}
