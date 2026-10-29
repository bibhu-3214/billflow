import { ui } from '../../styles/ui';
import { ArrowRight as ArrowForwardRoundedIcon, CirclePlay as PlayCircleOutlineRoundedIcon } from 'lucide-react';
import type { RouteComponentProps } from 'react-router-dom';
import { asAppError } from '../../types/domain';
import React, { useState } from 'react';

import { Link, useHistory } from 'react-router-dom';
import localData from '../../data/localData';

const Home = () => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const history = useHistory();
    const openDemo = async () => {
        setBusy(true);
        setError('');
        try {
            await localData.openDemo();
            // Reuse the existing session and Redux bootstrap on reload.
            window.location.assign(history.createHref({ pathname: '/admin' }));
        } catch (caughtError) { const failure = asAppError(caughtError);
            setError(failure.message);
            setBusy(false);
        }
    };
    return (
    <section className={ui("hero page-enter")}>
        <div className={ui("hero-grid")}>
            <div>
                <div className={ui("eyebrow")}><span className={ui("eyebrow-dot")} /> Operations, simplified</div>
                <h1>Run your billing with <span>clarity.</span></h1>
                <p className={ui("hero-copy")}>
                    Customers, products, invoices, and business performance in one focused workspace.
                    {localData.isCloud ? 'A considered workspace for your business, with one account across your devices.' : 'Explore a personal frontend project with a sample workspace, or create your own local account.'}
                </p>
                <div className={ui("hero-actions")}>
                    {!localData.isCloud && <button type='button' className={ui("hero-link primary")} onClick={openDemo} disabled={busy}>
                        <PlayCircleOutlineRoundedIcon /> {busy ? 'Preparing sample…' : 'Explore live demo'}
                    </button>}
                    <Link to='/register' className={ui("hero-link secondary")}>{localData.isCloud ? 'Create your free workspace' : 'Create local account'} <ArrowForwardRoundedIcon /></Link>
                </div>
                <p className={ui("demo-caption")}>{localData.isCloud ? 'Free to start. No payment card required. Manual payment records; no bank connection.' : 'No signup for the demo. Fictional data. Changes last for this tab’s session.'}</p>
                {error && <p role='alert'>{error}</p>}
            </div>
            <div className={ui("hero-visual")} aria-label='Illustrative dashboard preview with sample figures'>
                <div className={ui("hero-panel surface-card")}>
                    <p className={ui("demo-caption")}>Illustrative preview · sample figures</p>
                    <div className={ui("mock-top")}>
                        <div><div className={ui("mock-label")}>Revenue overview</div><div className={ui("mock-value")}>₹84,240</div></div>
                        <span className={ui("trend")}>↗ 12.8%</span>
                    </div>
                    <div className={ui("bars")} aria-hidden='true'>
                        {['h-[38%]', 'h-[54%]', 'h-[44%]', 'h-[71%]', 'h-[63%]', 'h-[92%]'].map(height => <span className={ui('bar', height)} key={height} />)}
                    </div>
                    <div className={ui("mock-stats")}>
                        <div className={ui("mock-stat")}><strong>148</strong><span>Invoices</span></div>
                        <div className={ui("mock-stat")}><strong>92</strong><span>Customers</span></div>
                        <div className={ui("mock-stat")}><strong>98.4%</strong><span>Collected</span></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    );
};

export default Home;
