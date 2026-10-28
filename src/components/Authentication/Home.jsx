import React, { useState } from 'react';
import ArrowForwardRoundedIcon from '@material-ui/icons/ArrowForwardRounded';
import PlayCircleOutlineRoundedIcon from '@material-ui/icons/PlayCircleOutlineRounded';
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
        } catch (failure) {
            setError(failure.message);
            setBusy(false);
        }
    };
    return (
    <section className='hero page-enter'>
        <div className='hero-grid'>
            <div>
                <div className='eyebrow'><span className='eyebrow-dot' /> Operations, simplified</div>
                <h1>Run your billing with <span>clarity.</span></h1>
                <p className='hero-copy'>
                    Customers, products, invoices, and business performance in one focused workspace.
                    {localData.isCloud ? 'A considered workspace for your business, with one account across your devices.' : 'Explore a personal frontend project with a sample workspace, or create your own local account.'}
                </p>
                <div className='hero-actions'>
                    {!localData.isCloud && <button type='button' className='hero-link primary' onClick={openDemo} disabled={busy}>
                        <PlayCircleOutlineRoundedIcon /> {busy ? 'Preparing sample…' : 'Explore live demo'}
                    </button>}
                    <Link to='/register' className='hero-link secondary'>{localData.isCloud ? 'Create your free workspace' : 'Create local account'} <ArrowForwardRoundedIcon /></Link>
                </div>
                <p className='demo-caption'>{localData.isCloud ? 'Free to start. No payment card required. Manual payment records; no bank connection.' : 'No signup for the demo. Fictional data. Changes last for this tab’s session.'}</p>
                {error && <p role='alert'>{error}</p>}
            </div>
            <div className='hero-visual' aria-label='Illustrative dashboard preview with sample figures'>
                <div className='hero-panel surface-card'>
                    <p className='demo-caption'>Illustrative preview · sample figures</p>
                    <div className='mock-top'>
                        <div><div className='mock-label'>Revenue overview</div><div className='mock-value'>₹84,240</div></div>
                        <span className='trend'>↗ 12.8%</span>
                    </div>
                    <div className='bars' aria-hidden='true'>
                        {[38, 54, 44, 71, 63, 92].map(height => <span className='bar' style={{ height: `${height}%` }} key={height} />)}
                    </div>
                    <div className='mock-stats'>
                        <div className='mock-stat'><strong>148</strong><span>Invoices</span></div>
                        <div className='mock-stat'><strong>92</strong><span>Customers</span></div>
                        <div className='mock-stat'><strong>98.4%</strong><span>Collected</span></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    );
};

export default Home;
