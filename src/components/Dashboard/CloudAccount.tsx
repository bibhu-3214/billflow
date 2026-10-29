import { ui } from '../../styles/ui';
import { Button, TextField } from '../ui/primitives';
import type { TransferPayload, ImportPreview } from '../../types/domain';
import { asAppError } from '../../types/domain';
import React, { useState } from 'react';

import cloudData from '../../data/cloudData';
import { migrationPayload } from '../../data/browserData';

export default function CloudAccount() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [preview, setPreview] = useState<{payload: TransferPayload; checked: ImportPreview} | null>(null);
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const clear = () => { setPreview(null); setConfirmation(''); setMessage(''); };
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setMessage('');
        try {
            if (!file || file.size > 20 * 1024 * 1024) throw new Error('Choose a BillFlow encrypted backup under 20 MB.');
            if (!preview) {
                const { profile: _profile, ...payload } = await migrationPayload(await file.text(), password);
                // Profile credentials are never transmitted. Existing business identity remains.
                // Account identity stays on this device.
                const checked = await cloudData.previewImport(payload);
                setPassword('');
                setPreview({ payload, checked });
            } else {
                if (confirmation !== 'IMPORT') throw new Error('Type IMPORT to confirm.');
                await cloudData.commitImport({ ...preview.checked, payload: preview.payload, confirmation });
                window.location.assign('/settings');
            }
        } catch (caughtError) { const error = asAppError(caughtError);  setMessage(error.message); }
        finally { setBusy(false); }
    };
    const remove = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || deleteConfirmation !== 'DELETE') return;
        setBusy(true); setMessage('');
        try { await cloudData.deleteAccount(deletePassword); window.location.assign('/'); }
        catch (caughtError) { const error = asAppError(caughtError);  setMessage(error.message); }
        finally { setBusy(false); }
    };
    return <>
        <section className={ui("surface-card settings-card backup-panel")}><span className={ui("workspace-kicker")}>BRING YOUR RECORDS</span><h2>Move your existing business here.</h2>
        <p>Use an encrypted BillFlow backup from the local build or a previous connected export. Decryption happens on this device; the backup password never leaves it. Preview uploads the decrypted records for validation. Import requires an empty business and never replaces existing records.</p>
        <form onSubmit={submit}><fieldset disabled={busy} className={ui("studio-fields cloud-transfer-fields")}>
            <label htmlFor='cloud-import-file'>Encrypted BillFlow backup (JSON, up to 20 MB)</label><input id='cloud-import-file' type='file' accept='.json,application/json' onChange={e => { clear(); setFile(e.target.files?.[0] || null); }} />
            {!preview && <TextField id='cloud-import-password' label='Backup file password' type='password' required autoComplete='off' value={password} onChange={e => { clear(); setPassword(e.target.value); }} />}
            {preview && <div className={ui("backup-preview")}><h3>Review this transfer</h3><ul>{Object.entries(preview.checked.counts).map(([kind, count]) => <li key={kind}>{kind}: {count}</li>)}</ul>
                <p>Historical records retain their original values. Imported history is a copy from your backup; it is not proof of prior server activity. After transferring, stop issuing invoices from the old local copy to prevent overlapping numbers.</p>
                {!preview.checked.canImport ? <p role='alert'>This business already contains records. Existing records will not be replaced.</p> : <TextField id='cloud-import-confirm' label='Type IMPORT to confirm' value={confirmation} onChange={e => setConfirmation(e.target.value)} required />}
                <Button onClick={() => { setPreview(null); setConfirmation(''); }}>Choose another backup</Button>
            </div>}
            <Button color='primary' variant='outlined' type='submit' disabled={busy || !file || Boolean(preview && (!preview.checked.canImport || confirmation !== 'IMPORT'))}>{busy ? 'Checking…' : preview ? 'Import reviewed records' : 'Preview transfer'}</Button>
        </fieldset></form><p role='status'>{message}</p></section>
        <section className={ui("surface-card settings-card backup-panel")}><h2>Account and data</h2><p>Your business records are stored with your account. Export and test an encrypted backup before closing the account. Account deletion permanently removes this business, invoices, payments and its application history. Backups you downloaded and infrastructure recovery copies follow their own retention rules.</p>
        <details><summary>Delete account and business</summary><form onSubmit={remove}><fieldset disabled={busy} className={ui("studio-fields")}><p>This cannot be undone. Keep any records your business is required to retain. Social sign-in users must first set a password through account recovery.</p>
            <TextField id='delete-password' label='Current account password' type='password' autoComplete='current-password' required value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
            <TextField id='delete-confirm' label='Type DELETE to confirm' required value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} />
            <Button type='submit' variant='outlined' disabled={busy || deleteConfirmation !== 'DELETE'}>Permanently delete account</Button>
        </fieldset></form></details></section>
    </>;
}
