import { ui } from '../styles/ui';
import React, { useEffect, useState } from 'react';
import { CircleCheck, CircleAlert } from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import { Button, DialogTitle, DialogContent, DialogActions } from './ui/primitives';
import { currentAlert, dismissAlert, subscribeAlerts } from '../utils/alerts';
export default function AlertHost() {
    const [alert, setAlert] = useState(currentAlert);
    useEffect(() => subscribeAlerts(() => setAlert(currentAlert())), []);
    return <WorkspaceDialog open={Boolean(alert)} size='compact' aria-labelledby='workspace-alert-title' onClose={() => dismissAlert(false)}>
        {alert && <><DialogTitle id='workspace-alert-title' className={ui("flex items-center gap-3")}>{alert.tone === 'success' ? <CircleCheck className={ui("size-7 text-success")} /> : <CircleAlert className={ui("size-7 text-danger")} />}{alert.title}</DialogTitle><DialogContent>{alert.message}</DialogContent><DialogActions><Button autoFocus variant='contained' onClick={() => dismissAlert(true)}>OK</Button></DialogActions></>}
    </WorkspaceDialog>;
}
