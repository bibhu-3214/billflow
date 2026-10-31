import React, {useEffect,useRef,useState} from 'react';
import { Button, TextField, MenuItem, DialogTitle, DialogContent, DialogActions } from '../../ui/primitives';
import WorkspaceDialog from '../../WorkspaceDialog';
import { useAppSelector } from '../../../Redux/hooks';
import localData from '../../../data/localData';
import type { Draft, FollowUp, Recurrence } from '../../../types/domain';
import { asAppError } from '../../../types/domain';
import { today } from '../../../utils/indiaBilling';
import { nextReviewDate, recurrenceAnchor } from '../../../utils/recurring';
export default function RecurringPlans({onPrepared}:{onPrepared:(draft:Draft)=>void}) {
    const invoices=useAppSelector(state=>state.bills.bills).filter(invoice=>!invoice.cancellation&&!invoice.creditNote);
    const [plans,setPlans]=useState<FollowUp[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false);
    const [editor,setEditor]=useState(false),[editing,setEditing]=useState<FollowUp|null>(null),[review,setReview]=useState<FollowUp|null>(null),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false);
    const [source,setSource]=useState(''),[title,setTitle]=useState(''),[cadence,setCadence]=useState<Recurrence['cadence']>('monthly'),[date,setDate]=useState(today);
    const pending=useRef(false),mounted=useRef(true);
    async function load(){setLoading(true);try{const data=await localData.getFollowUps();if(mounted.current)setPlans(data.filter(plan=>plan.recurrence));}catch(failure){if(mounted.current)setError(asAppError(failure).message);}finally{if(mounted.current)setLoading(false);}}
    useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[]);
    function edit(plan?:FollowUp){setDirty(false);setEditing(plan||null);setSource(plan?.recurrence?.invoiceId||invoices[0]?._id||'');setTitle(plan?.title||'Repeat customer invoice');setCadence(plan?.recurrence?.cadence||'monthly');setDate(plan?.dueDate||today());setError('');setEditor(true);}
    async function action(run:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await run();}catch(failure){if(mounted.current)setError(asAppError(failure).message);}finally{pending.current=false;if(mounted.current)setBusy(false);}}
    useEffect(()=>{
        if(!editor||!dirty)return;
        const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
        window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
    },[editor,dirty]);
    function closeEditor(){if(busy)return;if(dirty)setDiscard(true);else setEditor(false);}
    const visible=plans.filter(plan=>paused||plan.status==='open');
    return <section aria-label="Recurring invoice plans" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-ink">A repeatable sale, with a review step.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Weekly or monthly plans prepare one draft at current catalogue prices. You review and issue it. Missed periods are skipped; no invoice is issued automatically.</p></div><Button variant="contained" color="primary" disabled={!invoices.length||busy} onClick={()=>edit()}>New recurring plan</Button></header>
        {!invoices.length&&<p className="mt-4 rounded-xl bg-field p-4 text-sm text-muted">Issue an invoice first, then use it as the source for a repeat plan.</p>}
        {error&&!editor&&!review&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-primary-soft p-3 text-sm text-ink">{notice}</p>}
        <label className="my-5 flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={paused} onChange={event=>setPaused(event.target.checked)} className="size-4 accent-primary"/>Show paused plans</label>
        {loading&&<p role="status" className="py-5 text-sm text-muted">Loading recurring plans…</p>}
        {!loading&&!visible.length&&<p className="rounded-xl bg-field p-5 text-sm text-muted">No active recurring plans. Start with an existing invoice and choose its next review date.</p>}
        <div className="grid gap-4 sm:grid-cols-2">{visible.map(plan=><article key={plan._id} className="rounded-2xl border border-line bg-field p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 flex-1 break-words font-semibold text-ink">{plan.title}</h3><span className="rounded-lg bg-primary-soft px-2 py-1 text-xs text-ink">{plan.status==='completed'?'Paused':plan.dueDate<=today()?'Ready for review':'Scheduled'}</span></div><p className="mt-3 break-words text-sm text-muted">{plan.customerName} · {plan.recurrence?.cadence}</p><p className="mt-2 text-sm font-semibold text-ink">Next review {plan.dueDate}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="contained" color="primary" disabled={busy||plan.status!=='open'||plan.dueDate>today()} onClick={()=>{setError('');setReview(plan);}}>Prepare next draft</Button>{plan.history.some(event=>event.draftId)&&<Button disabled={busy} onClick={()=>void action(async()=>{
            const id=[...plan.history].reverse().find(event=>event.draftId)?.draftId;
            const draft=(await localData.getInvoiceDrafts()).find(draft=>draft._id===id);
            if(!draft)throw new Error('The latest draft was already issued or removed. Open issued invoices or saved drafts to review it.');
            if(mounted.current)onPrepared(draft);
        })}>Resume latest draft</Button>}<Button disabled={busy||plan.status!=='open'} onClick={()=>edit(plan)}>Edit plan</Button><Button disabled={busy} onClick={()=>void action(async()=>{await localData.setFollowUpStatus(plan._id,plan.revision,plan.status==='open'?'completed':'open',plan.status==='open'?'Paused recurring billing plan':'Resumed recurring billing plan');if(!mounted.current)return;await load();if(mounted.current)setNotice('Plan updated.');})}>{plan.status==='open'?'Pause plan':'Resume plan'}</Button></div></article>)}</div>
        <WorkspaceDialog open={editor} onClose={closeEditor} aria-labelledby="recurring-plan-title">
            <DialogTitle id="recurring-plan-title">{editing?'Edit recurring plan':'Create recurring plan'}</DialogTitle><DialogContent>
                <form onChange={()=>setDirty(true)} id="recurring-plan-form" className="grid gap-4" onSubmit={event=>{event.preventDefault();void action(async()=>{
                    const invoice=invoices.find(invoice=>invoice._id===source);if(!invoice)throw new Error('Choose an available source invoice.');
                    await localData.saveFollowUp({customer:invoice.customer,title,dueDate:date,priority:'Normal',channel:'In person',purpose:'Account review',notes:'Recurring invoice preparation plan. Review before issue.',recurrence:{invoiceId:source,cadence,anchorDay:recurrenceAnchor(date,cadence,editing)}},editing?._id,editing?.revision);
                    if(!mounted.current)return;await load();if(!mounted.current)return;setDirty(false);setEditor(false);setNotice('Recurring plan saved.');
                });}}>
                    <TextField disabled={busy} select label="Source invoice" value={source} required onChange={event=>setSource(event.target.value)}>{invoices.map(invoice=><MenuItem key={invoice._id} value={invoice._id}>{invoice.invoiceNumber||invoice._id}</MenuItem>)}</TextField>
                    <TextField disabled={busy} label="Plan name" value={title} required inputProps={{maxLength:80}} onChange={event=>setTitle(event.target.value)}/>
                    <TextField disabled={busy} select label="Repeat cadence" value={cadence} onChange={event=>setCadence(event.target.value==='weekly'?'weekly':'monthly')}><MenuItem value="weekly">Weekly</MenuItem><MenuItem value="monthly">Monthly</MenuItem></TextField>
                    <TextField disabled={busy} label="Next review date" type="date" value={date} required onChange={event=>setDate(event.target.value)}/>
                    <p className="text-xs leading-5 text-muted">Monthly plans keep day {editing?.recurrence?.cadence===cadence && editing.dueDate===date ? editing.recurrence.anchorDay : Number(date.slice(-2)) || '—'}, using month end when that day is unavailable.</p>
                    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
                </form>
            </DialogContent><DialogActions><Button disabled={busy} onClick={closeEditor}>Cancel</Button><Button form="recurring-plan-form" type="submit" variant="contained" color="primary" disabled={busy}>{busy?'Saving…':'Save recurring plan'}</Button></DialogActions>
        </WorkspaceDialog>
        <WorkspaceDialog open={discard} onClose={()=>setDiscard(false)} aria-labelledby="discard-recurring-title"><DialogTitle id="discard-recurring-title">Discard plan changes?</DialogTitle><DialogContent>These plan edits have not been saved.</DialogContent><DialogActions><Button onClick={()=>setDiscard(false)}>Keep editing</Button><Button color="secondary" onClick={()=>{setDiscard(false);setDirty(false);setEditor(false);}}>Discard plan changes</Button></DialogActions></WorkspaceDialog>
        <WorkspaceDialog open={Boolean(review)} onClose={()=>{if(!busy)setReview(null);}} aria-labelledby="prepare-recurring-title">
            <DialogTitle id="prepare-recurring-title">Prepare recurring invoice draft?</DialogTitle><DialogContent><p className="text-sm leading-7 text-muted">Prepare one draft dated {today()} using current catalogue prices. Review its tax details, payment terms and item quantities before issuing.</p>{review?.recurrence&&<p className="mt-3 text-sm font-semibold text-ink">Next scheduled review: {nextReviewDate(review.dueDate,review.recurrence.cadence,review.recurrence.anchorDay,today())}</p>}{error&&<p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</DialogContent><DialogActions><Button disabled={busy} onClick={()=>setReview(null)}>Keep plan</Button><Button disabled={busy} variant="contained" color="primary" onClick={()=>{if(review)void action(async()=>{const draft=await localData.prepareRecurringInvoice(review._id,review.revision);if(!mounted.current)return;await load();if(!mounted.current)return;setReview(null);setNotice('Draft prepared. No invoice was issued.');onPrepared(draft);});}}>{busy?'Preparing…':'Prepare draft'}</Button></DialogActions>
        </WorkspaceDialog>
    </section>;
}
