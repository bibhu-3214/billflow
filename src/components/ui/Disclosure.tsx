import React from 'react';
import type {DetailsHTMLAttributes,ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import {ui} from '../../styles/ui';

interface DisclosureProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
    summary:ReactNode;
    summaryClassName?:string;
}

export default function Disclosure({summary,summaryClassName,className,children,...props}:DisclosureProps) {
    return <details {...props} className={ui('min-w-0 text-sm text-ink',className)}>
        <summary className={ui('flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2.5 text-left text-sm font-semibold transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary [&::-webkit-details-marker]:hidden motion-reduce:transition-none',summaryClassName)}>
            <span className='min-w-0 flex-1'>{summary}</span>
            <ChevronDown aria-hidden='true' data-disclosure-chevron='' className='size-4 shrink-0 text-muted transition-transform [[open]>summary>&]:rotate-180 motion-reduce:transition-none' />
        </summary>
        <div className='pt-2 text-sm leading-relaxed text-muted [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline'>{children}</div>
    </details>;
}
