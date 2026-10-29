import { ui } from '../../styles/ui';
import { Button, TextField } from '../ui/primitives';
import { asAppError } from '../../types/domain';
import { captureSession } from '../../utils/sessionBoundary';
import React, { useState } from 'react';

import localData from '../../data/localData';
import { today } from '../../utils/indiaBilling';

export default function BackupExport() {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [password, setPassword] = useState('');
    const [repeat, setRepeat] = useState('');
    const download = async () => {
        const current = captureSession();
        setBusy(true); setMessage('');
        try {
            if (localData.isCloud && (password.length < 12 || password !== repeat)) throw new Error('Choose and confirm a backup password of at least 12 characters.');
            const data = await localData.exportBackup(password);
            current();
            const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url; link.download = 'BillFlow-backup-' + today() + '.json';
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            setMessage('Download requested. Confirm the file was saved, then test recovery in a separate browser profile.');
            setPassword(''); setRepeat('');
        } catch (caughtError) { const error = asAppError(caughtError);  setMessage(error.message); }
        finally { setBusy(false); }
    };
    return <section className={ui("surface-card settings-card backup-panel")}><h2>Encrypted workspace backup</h2>
        <p>Download your customers, catalog, manual stock balances and movement history, customer follow-ups and outcomes, invoice drafts, quotations, item templates, issued invoices, payments, corrections, numbering and business settings. Only this account is included; session credentials are not exported.</p>
        <p>Keep the file somewhere safe outside this browser. {localData.isCloud ? 'Choose a separate backup password and retain it securely. Account recovery cannot unlock an encrypted backup.' : 'You must retain your current account password: there is no password recovery.'} Anyone with both the file and password can read it.</p>
        {localData.isCloud && <div className={ui("studio-grid")}><TextField id='backup-password' label='Backup password' type='password' autoComplete='new-password' value={password} disabled={busy} inputProps={{ minLength: 12, maxLength: 128 }} onChange={e => setPassword(e.target.value)} /><TextField id='backup-repeat' label='Confirm backup password' type='password' autoComplete='new-password' value={repeat} disabled={busy} onChange={e => setRepeat(e.target.value)} /></div>}
        <Button variant='outlined' color='primary' disabled={busy} onClick={download}>{busy ? 'Preparing…' : 'Download encrypted backup'}</Button>
        <p role='status'>{message}</p><p>{localData.isCloud ? 'To recover a snapshot into a new empty business, use the import section in Settings. Server disaster recovery must be tested separately.' : 'To recover, open Sign in → Recover from an encrypted backup. Backups are manual snapshots, not automatic cloud sync.'}</p>
    </section>;
}
