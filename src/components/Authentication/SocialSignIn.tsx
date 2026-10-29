import { ui } from '../../styles/ui';
import { Button } from '../ui/primitives';
import type { PublicConfig } from '../../types/domain';
import React, { useEffect, useState } from 'react';

import cloudData, { isCloudMode } from '../../data/cloudData';

export default function SocialSignIn() {
    const [config, setConfig] = useState<PublicConfig | null>(null);
    useEffect(() => {
        let active = true;
        if (isCloudMode) cloudData.publicConfig().then(value => { if (active) setConfig(value); }).catch(() => {});
        return () => { active = false; };
    }, []);
    if (!config?.providers?.length) return null;
    return <form action='/_allauth/browser/v1/auth/provider/redirect' method='post' className={ui("auth-form")}>
        <input type='hidden' name='csrfmiddlewaretoken' value={config.csrfToken} />
        <input type='hidden' name='callback_url' value={window.location.origin + '/admin'} />
        <input type='hidden' name='process' value='login' />
        {config.providers.map(provider => <Button type='submit' name='provider' value={provider} key={provider} variant='outlined'>Continue with {provider === 'google' ? 'Google' : 'Apple'}</Button>)}
    </form>;
}
