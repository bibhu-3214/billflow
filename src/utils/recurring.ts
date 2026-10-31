import type { DraftInput, FollowUp, FollowUpInput, Workspace } from '../types/domain';
const DAY=86400000;
const dateValue=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Choose a valid schedule date.');return new Date(value+'T00:00:00Z');};
export function nextReviewDate(due:string,cadence:'weekly'|'monthly',anchor:number,asOf:string):string {
    const start=dateValue(due),today=dateValue(asOf);if(!Number.isInteger(anchor)||anchor<1||anchor>31)throw new Error('Invalid monthly anchor.');
    let result:Date;
    if(cadence==='weekly'){result=new Date(start.getTime()+Math.max(1,Math.floor((today.getTime()-start.getTime())/(7*DAY))+1)*7*DAY);}
    else if(cadence==='monthly'){
        const months=Math.max(1,(today.getUTCFullYear()-start.getUTCFullYear())*12+today.getUTCMonth()-start.getUTCMonth());
        const monthDate=(offset:number)=>{const base=new Date(start);base.setUTCDate(1);base.setUTCMonth(base.getUTCMonth()+offset);const last=new Date(base);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);base.setUTCDate(Math.min(anchor,last.getUTCDate()));return base;};
        result=monthDate(months);if(result<=today)result=monthDate(months+1);
    }else throw new Error('Choose a weekly or monthly cadence.');
    const output=result.toISOString().slice(0,10);dateValue(output);return output;
}
export function recurrenceAnchor(date:string,cadence:'weekly'|'monthly',previous?:Pick<FollowUp,'dueDate'|'recurrence'>|null):number {
    dateValue(date);
    return previous?.recurrence?.cadence===cadence && previous.dueDate===date ? previous.recurrence.anchorDay : Number(date.slice(-2));
}
export function recurrenceFields(value:FollowUpInput['recurrence'],workspace:Workspace,customer:string) {
    if(value===undefined)return undefined;
    if(!value||typeof value!=='object'||Object.keys(value).some(key=>!['invoiceId','cadence','anchorDay'].includes(key))||!['weekly','monthly'].includes(value.cadence)||!Number.isInteger(value.anchorDay)||value.anchorDay<1||value.anchorDay>31)throw new Error('Choose valid recurring invoice details.');
    const invoice=workspace.bills.find(invoice=>invoice._id===value.invoiceId);
    if(!invoice||invoice.customer!==customer)throw new Error('Choose an invoice for this customer.');
    return {invoiceId:invoice._id,cadence:value.cadence,anchorDay:value.anchorDay};
}
export function recurringDraft(record:FollowUp,workspace:Workspace,asOf:string):{values:DraftInput;nextDate:string} {
    dateValue(asOf);if(record.status!=='open'||!record.recurrence||record.dueDate>asOf)throw new Error('This recurring plan is paused or is not due yet.');
    const recurrence=recurrenceFields(record.recurrence,workspace,record.customer)!;
    const source=workspace.bills.find(invoice=>invoice._id===recurrence.invoiceId)!;
    if(source.cancellation||source.creditNote)throw new Error('The source invoice was cancelled or credited. Choose another source.');
    const customer=workspace.customers.find(customer=>customer._id===record.customer);if(!customer)throw new Error('The customer is unavailable.');
    const term=Math.max(0,Math.round((dateValue((source.dueDate||source.date).slice(0,10)).getTime()-dateValue(source.date.slice(0,10)).getTime())/DAY));
    const dueDate=new Date(dateValue(asOf).getTime()+term*DAY).toISOString().slice(0,10);dateValue(dueDate);
    const lineItems=source.lineItems.map(item=>{const product=workspace.products.find(product=>product._id===item.product);if(!product)throw new Error('A source product is unavailable.');return {product:product._id,quantity:item.quantity,discount:item.discount||0,gstRate:product.gstRate??'',unit:product.unit||'NOS',hsn:product.hsn||''};});
    if(!lineItems.length)throw new Error('The source invoice has no products.');
    return {values:{title:record.title,customer:record.customer,date:asOf,dueDate,billingAddress:customer.address||source.customerSnapshot?.address||'',notes:source.notes||'',gst:source.gst,supplierGSTIN:workspace.settings.gstin||source.supplierSnapshot?.gstin||'',customerGSTIN:customer.gstin||'',supplierState:source.supplierState||'',placeOfSupply:source.placeOfSupply||'',lineItems},nextDate:nextReviewDate(record.dueDate,recurrence.cadence,recurrence.anchorDay,asOf)};
}
