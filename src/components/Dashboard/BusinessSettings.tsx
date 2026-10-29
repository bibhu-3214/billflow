import {fileInputClass} from '../ui/fileStyles';
import { ui } from '../../styles/ui';
import { Button, TextField, MenuItem } from '../ui/primitives';
import type { BusinessSettings as Settings } from '../../types/domain';
import { asAppError } from '../../types/domain';
import React, { useEffect, useState } from 'react';

import localData from '../../data/localData';
import { states } from '../../utils/indiaBilling';
import BackupExport from './BackupExport';
import CloudAccount from './CloudAccount';

export default function BusinessSettings() {
    const [values, setValues] = useState<(Omit<Settings, 'dueDays'> & { dueDays: string | number }) | null>(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [coverage, setCoverage] = useState<{stock: number; tasks: number; open: number} | null>(null);
    const [coverageError, setCoverageError] = useState('');
    useEffect(() => {
        let active = true;
        localData.getSettings().then(result => { if (active) setValues(result); }).catch((e: unknown) => { if (active) setMessage(asAppError(e).message); });
        Promise.all([localData.getStockRecords(), localData.getFollowUps()]).then(([stock, tasks]) => { if (active) setCoverage({ stock: stock.length, tasks: tasks.length, open: tasks.filter(task => task.status === 'open').length }); }).catch((e: unknown) => { if (active) setCoverageError(asAppError(e).message); });
        return () => { active = false; };
    }, []);
    const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 130000) { setMessage('Choose a PNG or JPEG under 130 KB.'); return; }
        const reader = new FileReader();
        reader.onload = () => setValues(current => current && typeof reader.result === 'string' ? { ...current, logo: reader.result } : current);
        reader.onerror = () => setMessage('The image could not be read.');
        reader.readAsDataURL(file);
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setMessage('');
        try { if (!values) return; await localData.saveSettings(values); setMessage('Business defaults saved. Existing invoices are unchanged.'); }
        catch (caughtError) { const error = asAppError(caughtError);  setMessage(asAppError(error).message); }
        finally { setBusy(false); }
    };
    return <section className={ui("workspace-page page-enter settings-workspace")}><div className={ui("workspace-heading")}><div><span className={ui("workspace-kicker")}>WORKSPACE / DEFAULTS</span><h1>Business settings</h1><p>Set up your identity, branding and payment instructions once.</p></div></div>
        <p role='status'>{message}</p>
        {values && <form className={ui("surface-card settings-card")} onSubmit={save}><fieldset disabled={busy} className={ui("studio-fields")}>
            <section className={ui("settings-section")}><h2>Business identity</h2><p>The details customers will see on new invoices.</p><div className={ui("studio-grid")}>
                {([['name', 'Business / legal name'], ['address', 'Business address'], ['gstin', 'GSTIN (optional)'], ['dueDays', 'Payment due in days']] as const).map(([key, label]) =>
                    <TextField id={'settings-' + key} key={key} variant='outlined' label={label} value={values[key]} required={['name', 'address', 'dueDays'].includes(key)} type={key === 'dueDays' ? 'number' : 'text'} inputProps={key === 'dueDays' ? { min: 0, max: 365, step: 1 } : { maxLength: key === 'gstin' ? 15 : 500 }} onChange={e => setValues({ ...values, [key]: e.target.value })} />)}
                <TextField id='settings-state' select variant='outlined' label='State / union territory' value={values.state} onChange={e => setValues({ ...values, state: e.target.value })}><MenuItem value=''>Not set</MenuItem>{Object.entries(states).map(([code, name]) => <MenuItem key={code} value={code}>{code} · {name}</MenuItem>)}</TextField>
            </div></section>
            <section className={ui("settings-section")}><h2>Invoice branding</h2><p>A recognisable identity, without changing issued records.</p>{values.logo && <img className={ui("business-logo")} src={values.logo} alt='Business logo preview' />}
            <p><label htmlFor='business-logo'>Logo · PNG/JPEG, up to 130 KB</label><br /><input id='business-logo' type='file' className={fileInputClass} accept='image/png,image/jpeg' onChange={upload} /></p>
            {values.logo && <Button onClick={() => setValues({ ...values, logo: '' })}>Remove logo</Button>}
            </section><section className={ui("settings-section")}><h2>Payment instructions</h2><p>Help customers understand when and how to pay.</p>
            <div className={ui("studio-grid")}>{([['terms', 'Default payment terms'], ['bankDetails', 'Bank / UPI payment instructions']] as const).map(([key, label]) => <TextField id={'settings-' + key} key={key} variant='outlined' label={label} multiline rows={3} inputProps={{ maxLength: key === 'terms' ? 1000 : 500 }} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} />)}</div>
            <p className={ui("studio-hint")}>New invoices retain a copy of these details. Bank and UPI instructions are text only; BillFlow does not collect payments.</p>
            </section>
            <Button type='submit' color='primary' variant='contained' disabled={busy}>{busy ? 'Saving…' : 'Save defaults'}</Button>
        </fieldset></form>}
        <section className={ui("surface-card settings-card")}><span className={ui("workspace-kicker")}>RECOVERY &amp; OPERATIONAL BOUNDARIES</span><h2>Protect the work beyond billing.</h2>{coverageError ? <p role='alert'>{coverageError} Reopen Settings to reload recovery coverage.</p> : coverage ? <p>Your encrypted backup includes {coverage.stock} tracked product balances with movement history and {coverage.tasks} customer follow-ups ({coverage.open} open), alongside the catalog and financial records.</p> : <p role='status'>Checking recovery coverage…</p>}<p>Stock is updated only by manual counts and adjustments. Customer tasks never send messages. {localData.isCloud ? 'Saved changes are stored with your account. Reopen a page to load changes made on another device.' : 'Neither workflow is shared across devices; export backups regularly and retain the account password securely.'}</p><p className={ui("studio-hint")}>Coverage counts are not proof that you downloaded or tested a backup. Validate restoration in an isolated browser profile before relying on recovery.</p></section>
        <BackupExport />
        {localData.isCloud && <CloudAccount />}
    </section>;
}
