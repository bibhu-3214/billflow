import { ui } from '../../styles/ui';
import { Button, TextField } from '../ui/primitives';
import { asAppError } from '../../types/domain';
import React, { useState } from 'react';

import { Link } from 'react-router-dom';
import cloudData, { isCloudMode } from '../../data/cloudData';

export default function AccountRecovery() {
    const [params] = useState(() => {
        const value = new URLSearchParams(window.location.search);
        // Private keys remain only in memory and never in the copied page URL.
        if (value.has('verify') || value.has('resetKey')) window.history.replaceState(null, '', '/account');
        return value;
    });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [key, setKey] = useState(params.get('verify') || '');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const resetKey = params.get('resetKey');
    const recovering = params.has('reset') || Boolean(resetKey);
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setMessage('');
        try {
            if (resetKey) {
                await cloudData.auth('auth/password/reset', { key: resetKey, password }, true);
                setPassword(''); setMessage('Password updated. Sign in with your new password.');
            } else if (recovering) {
                await cloudData.auth('auth/password/request', { email }, true);
                setMessage('If this address has an account, a recovery email will arrive shortly.');
            } else {
                await cloudData.auth('auth/email/verify', { key }, true);
                setKey(''); setMessage('Email verified. You can now sign in.');
            }
        } catch (caughtError) { const error = asAppError(caughtError);  setMessage(error.message); }
        finally { setBusy(false); }
    };
    return <section className={ui("workspace-page settings-workspace page-enter")}><div className={ui("workspace-heading")}><div><span className={ui("workspace-kicker")}>ACCOUNT / ACCESS</span><h1>{recovering ? 'Recover your account' : 'Verify your email'}</h1><p>{recovering ? 'Get back to your business.' : 'Confirm the address you use for BillFlow.'}</p></div></div>
        {isCloudMode ? <form className={ui("surface-card settings-card auth-form")} onSubmit={submit}><fieldset disabled={busy} className={ui("studio-fields")}>
            {resetKey ? <TextField id='recovery-password' label='New password' type='password' autoComplete='new-password' value={password} onChange={e => setPassword(e.target.value)} required inputProps={{ minLength: 12, maxLength: 128 }} /> : recovering ? <TextField id='recovery-email' label='Account email' type='email' autoComplete='email' value={email} onChange={e => setEmail(e.target.value)} required /> : <><p>Open the link in your verification email, or paste its verification key below.</p><TextField id='verification-key' label='Verification key' value={key} onChange={e => setKey(e.target.value)} required autoComplete='off' /></>}
            <Button type='submit' variant='contained' color='primary' disabled={busy}>{busy ? 'Working…' : resetKey ? 'Save new password' : recovering ? 'Request recovery email' : 'Verify email'}</Button>
        </fieldset><p role='status'>{message}</p><Link to='/login'>Back to sign in</Link></form> : <p>This local build uses encrypted backup recovery on the sign-in screen.</p>}
    </section>;
}
