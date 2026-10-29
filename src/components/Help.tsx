import { ui } from '../styles/ui';
import { Button } from './ui/primitives';
import React, { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';
import cloudData, { isCloudMode } from '../data/cloudData';

export default function Help() {
    const [address, setAddress] = useState<string | undefined>(undefined);
    const [message, setMessage] = useState('');
    useEffect(() => {
        let active = true;
        if (isCloudMode) cloudData.publicConfig().then(value => { if (active) setAddress(value.supportEmail); }).catch(() => { if (active) setMessage('Support details are temporarily unavailable. Try again later.'); });
        return () => { active = false; };
    }, []);
    return <section className={ui("workspace-page settings-workspace page-enter")}><div className={ui("workspace-heading")}><div><span className={ui("workspace-kicker")}>HELP / BILLFLOW</span><h1>A little help, when you need it.</h1><p>Keep your business moving with clear answers.</p></div></div>
        <section className={ui("surface-card settings-card")}><h2>Your account and records</h2><details><summary>How do I recover access?</summary><p>{isCloudMode ? 'Request a password reset using your verified account email. Your records remain in your business workspace.' : 'Use an encrypted backup and the password used when it was created, in a separate browser profile.'}</p><Link to={isCloudMode ? '/account?reset=1' : '/login'}>Open account recovery</Link></details>
        <details><summary>Do invoices update my stock or bank balance?</summary><p>Stock counts are adjusted manually. Payments are records you enter; BillFlow does not connect to banks, move money, send WhatsApp messages or file GST returns.</p></details>
        <details><summary>Can I bring my existing local records?</summary><p>{isCloudMode ? 'Export an encrypted backup from the local build, sign in here and open Settings. Decrypt the backup on your device, review the counts and confirm IMPORT. Transfers require an empty business. Continue issuing from the connected business only, to avoid overlapping invoice numbers.' : 'Download an encrypted backup in Settings and test restoration in a separate browser profile.'}</p></details>
        <details><summary>Is BillFlow a complete GST filing system?</summary><p>No. It supports the existing domestic invoicing workflow. Tax treatment, classifications and statutory requirements need professional review. E-invoice registration, e-way bills, exports and reverse charge are not implemented.</p></details></section>
        <section className={ui("surface-card settings-card")}><h2>Contact support</h2>{address ? <><p>Include a short description of the issue. Share financial records only when you deliberately choose to.</p><p><a href={'mailto:' + address}>{address}</a></p><Button variant='outlined' onClick={async () => { try { await navigator.clipboard.writeText(address); setMessage('Support address copied.'); } catch { setMessage('Copy is unavailable. Select the address above.'); } }}>Copy address</Button></> : <p>A support mailbox has not been activated for this development build.</p>}<p role='status'>{message}</p></section>
    </section>;
}
