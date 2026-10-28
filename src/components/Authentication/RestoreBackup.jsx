import React, { useState } from 'react';
import { Button, TextField } from '@material-ui/core';
import localData from '../../data/localData';

export default function RestoreBackup() {
    const [file, setFile] = useState(null);
    const [password, setPassword] = useState('');
    const [preview, setPreview] = useState(null);
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const resetPreview = () => { setPreview(null); setConfirmation(''); setMessage(''); };
    const submit = async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setMessage('');
        try {
            if (!file || file.size > 20 * 1024 * 1024) throw new Error('Choose a BillFlow backup under 20 MB.');
            const text = await file.text();
            if (!preview) setPreview(await localData.previewBackup(text, password));
            else {
                if (confirmation !== 'RESTORE') throw new Error('Type RESTORE to confirm.');
                const email = await localData.restoreBackup(text, password);
                setPassword(''); setPreview(null); setConfirmation(''); setFile(null);
                setMessage('Restored successfully. Sign in above with ' + email + ' and your original password.');
            }
        } catch (error) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    return <details className='backup-panel'><summary>Recover from an encrypted backup</summary>
        <p>Nothing is uploaded. Use the account password from when you exported the backup. Existing accounts will never be replaced or merged.</p>
        <form onSubmit={submit}><fieldset disabled={busy} className='studio-fields'>
            <label htmlFor='restore-file'>BillFlow backup file (JSON, up to 20 MB)</label>
            <input id='restore-file' type='file' accept='.json,application/json' onChange={e => { resetPreview(); setFile(e.target.files[0] || null); }} />
            <TextField id='restore-password' label='Backup account password' type='password' required autoComplete='off' fullWidth value={password} onChange={e => { resetPreview(); setPassword(e.target.value); }} />
            {preview && <div className='backup-preview'><strong>{preview.businessName}</strong><p>{preview.email}</p><p>Backup created: {preview.createdAt}</p>
                <p>{preview.customers} customers · {preview.products} products · {preview.invoices} invoices · {preview.drafts || 0} drafts · {preview.quotations || 0} quotations · {preview.templates || 0} templates · {preview.trackedProducts || 0} tracked stock records · {preview.followUps || 0} follow-ups</p>
                <p>Recovery restores this snapshot only. Later transactions are not included. Do not issue invoices from both copies: their number sequences can overlap.</p>
                <TextField id='restore-confirmation' label='Type RESTORE to confirm' required fullWidth value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            </div>}
            <Button type='submit' variant='outlined' color='primary' disabled={busy || !file || (preview && confirmation !== 'RESTORE')}>{busy ? 'Checking…' : preview ? 'Restore as a recovered account' : 'Verify backup'}</Button>
        </fieldset></form><p role='status'>{message}</p>
    </details>;
}
