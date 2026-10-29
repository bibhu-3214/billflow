import React from 'react';
import type {PropsWithChildren} from 'react';
import {Link} from 'react-router-dom';
import {RefreshCw} from 'lucide-react';

export default class PageBoundary extends React.Component<PropsWithChildren<{}>, {failed: boolean}, unknown> {
    override state = {failed: false};
    static getDerivedStateFromError() { return {failed: true}; }
    override render() {
        if (!this.state.failed) return this.props.children;
        return <section role='alert' className='mx-auto my-12 max-w-lg rounded-2xl border border-line bg-surface p-8 text-ink shadow-sm'>
            <RefreshCw className='mb-5 text-primary' aria-hidden='true' />
            <h1 className='text-xl font-semibold'>This page couldn’t open.</h1>
            <p className='mt-3 text-sm leading-relaxed text-muted'>A connection issue or an updated app may have interrupted loading. Reload to try again. Any unfinished entries on this page may need to be entered again.</p>
            <div className='mt-6 flex flex-wrap items-center gap-4'><button type='button' onClick={() => window.location.reload()} className='rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white dark:text-[#181a31]'>Reload page</button><Link to='/help' className='text-sm font-medium text-primary'>Open help</Link></div>
        </section>;
    }
}
