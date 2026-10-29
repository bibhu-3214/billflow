import Disclosure from '../../ui/Disclosure';
import type {CSSProperties} from 'react';
import React, {useState} from 'react';
import moment from 'moment';
import SelectControl from '../../ui/SelectControl';
import {useAppSelector} from '../../../Redux/hooks';
import {getMonthlySales} from '../../../utils/billing';
import {money} from '../../../utils/indiaBilling';
import {totalAmounts} from '../../../utils/overview';

export default function BarChart() {
    const bills = useAppSelector(state => state.bills.bills);
    const [months, setMonths] = useState(6);
    const [selected, setSelected] = useState<string | null>(null);
    const data = getMonthlySales(bills, months);
    const maximum = Math.max(...data.map(([,value]) => value),1);
    const current = data.find(([label]) => label === selected) || data[data.length - 1];
    const count = bills.filter(bill => !bill.cancellation && !bill.creditNote && moment(bill.date).format('MMM YYYY') === current[0]).length;
    return <div>
        <div className='flex flex-wrap items-start justify-between gap-4'>
            <div><p className='text-[10px] font-semibold tracking-[.15em] text-muted uppercase'>Sales performance</p><h2 className='mt-1 text-lg font-semibold text-ink'>Invoice value over time</h2><p className='mt-1 text-xs text-muted'>Issued value including tax; cancelled and credited invoices excluded.</p></div>
            <label className='flex items-center gap-2 text-xs text-muted'><span className='sr-only'>Chart period</span><SelectControl aria-label='Chart period' value={months} onChange={event => {const value=Number(event.target.value); if ([3,6,12].includes(value)) {setMonths(value); setSelected(null);}}} className='rounded-lg border border-line bg-field px-3 py-2 font-medium text-ink'><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></SelectControl></label>
        </div>
        <div className='mt-6 flex flex-wrap items-end justify-between gap-4'><div><p className='text-xs text-muted'>Selected month · {current[0]}</p><strong className='mt-1 block text-2xl font-semibold tracking-tight text-ink' aria-live='polite'>{money(current[1])}</strong><p className='mt-1 text-xs text-muted'>{count} issued {count===1?'invoice':'invoices'}</p></div><p className='text-right text-xs text-muted'>Period total<strong className='mt-1 block text-sm font-semibold text-ink'>{money(totalAmounts(data.map(([,value])=>value)))}</strong></p></div>
        <div className='mt-5 overflow-x-auto pb-2'><div className={'relative flex items-end gap-2 pt-3 '+(months===12?'min-w-[540px]':'min-w-[300px]')} role='group' aria-label='Monthly invoice values'>
            {data.map(([label,value])=><button type='button' key={label} aria-label={`${label}: ${money(value)}`} aria-pressed={label===current[0]} onClick={()=>setSelected(label)} className='group flex min-w-0 flex-1 flex-col items-center rounded-lg px-1 pt-2 transition-colors hover:bg-primary-soft/60 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary-soft/60'>
                <span className='relative flex h-[132px] w-full items-end justify-center border-b border-line'><span className='block w-[min(70%,34px)] rounded-t-md bg-primary/65 transition-colors group-hover:bg-primary group-aria-pressed:bg-primary motion-reduce:transition-none h-[var(--bar-height)]' style={{'--bar-height':`${value/maximum*100}%`} as CSSProperties} /></span>
                <span className='mt-3 mb-2 text-[10px] font-medium text-muted'>{label}</span>
            </button>)}
        </div></div>
        <Disclosure className='mt-3 border-t border-line pt-3 text-xs text-muted' summaryClassName='w-fit rounded font-medium text-primary' summary={<> View monthly figures </>}><table className='mt-3 w-full text-left'><caption className='sr-only'>Invoice value by month, including tax</caption><thead><tr><th scope='col' className='py-2'>Month</th><th scope='col' className='py-2 text-right'>Invoiced</th></tr></thead><tbody>{data.map(([label,value])=><tr key={label} className='border-t border-line'><td className='py-2'>{label}</td><td className='py-2 text-right text-ink'>{money(value)}</td></tr>)}</tbody></table></Disclosure>
    </div>;
}
