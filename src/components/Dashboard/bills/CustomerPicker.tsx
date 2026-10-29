import React, {useState} from 'react';
import {Search} from 'lucide-react';
import {InputAdornment, MenuItem, TextField} from '../../ui/primitives';
import type {Customer} from '../../../types/domain';

export default function CustomerPicker({customers,value,onSelect,disabled=false}: {customers:readonly Customer[];value?:string;onSelect:(customer:Customer)=>void;disabled?:boolean}) {
    const [query,setQuery]=useState('');
    const tokens=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches=customers.filter(customer=>tokens.every(token=>`${customer.name} ${customer.company||''} ${customer.email} ${customer.mobile} ${customer.gstin||''}`.toLowerCase().includes(token)));
    const current=customers.find(customer=>customer._id===value);
    const visible=current&&!matches.some(customer=>customer._id===current._id)?[current,...matches]:matches;
    const select=(id:string)=>{const customer=customers.find(item=>item._id===id);if(customer&&!disabled)onSelect(customer);};
    return <div className='col-span-full grid min-w-0 gap-4 sm:grid-cols-2' role='group' aria-label='Customer lookup'>
        <TextField id='invoice-customer-search' type='search' label='Find customer' value={query} disabled={disabled} autoComplete='off' inputProps={{maxLength:120}}
            InputProps={{startAdornment:<InputAdornment><Search size={17} className='mr-2' aria-hidden='true' /></InputAdornment>}}
            helperText={query&&!matches.length?'No matching profiles. Your current selection is unchanged.':'Name, company, phone, email or GSTIN. Enter selects a unique match.'}
            onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(!event.repeat&&!event.nativeEvent.isComposing&&query.trim()&&matches.length===1)select(matches[0]._id);}}} />
        <TextField id='invoice-customer' name='customer' label='Customer' select required value={value||''} disabled={disabled} helperText='Selecting a customer fills their billing details. Search alone does not change them.' onChange={event=>select(event.target.value)}>
            {visible.map(customer=><MenuItem key={customer._id} value={customer._id}>{customer.name}{customer.company?` · ${customer.company}`:''}{customer.mobile||customer.email?` · ${customer.mobile||customer.email}`:''}</MenuItem>)}
        </TextField>
    </div>;
}
