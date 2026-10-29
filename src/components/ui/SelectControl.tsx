import React, {useRef, useState} from 'react';
import type {ReactNode, SelectHTMLAttributes, OptionHTMLAttributes} from 'react';
import * as Select from '@radix-ui/react-select';
import {Check, ChevronDown, ChevronUp} from 'lucide-react';
import {changeNativeValue, blurNativeControl, isFirstInvalid} from './nativeEvents';
import {ui} from '../../styles/ui';

type SelectOption = {value:string; label:ReactNode; text:string; disabled?:boolean};
function textOf(node:ReactNode):string {
    if (typeof node==='string'||typeof node==='number')return String(node);
    if(Array.isArray(node))return node.map(textOf).join('');
    return React.isValidElement<{children?:ReactNode}>(node)?textOf(node.props.children):'';
}
function optionsOf(children:ReactNode):SelectOption[] {
    return React.Children.toArray(children).flatMap(child=>{
        if(!React.isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child))return [];
        if(child.type===React.Fragment||child.type==='optgroup')return optionsOf(child.props.children);
        return [{value:String(child.props.value??''),label:child.props.children,text:textOf(child.props.children),disabled:child.props.disabled}];
    });
}
export interface SelectControlProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>,'value'|'multiple'|'size'> {
    value?:string|number|readonly string[];
    placeholder?:string;
    onInvalidMessage?:(message:string)=>void;
}
export default function SelectControl({id,value,children,className,placeholder='Choose an option',onInvalidMessage,...props}:SelectControlProps) {
    const proxy=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null);
    const [open,setOpen]=useState(false);
    const options=optionsOf(children);
    const raw=String(value??'');
    const selected=options.findIndex(option=>option.value===raw);
    const encoded=selected<0?'':`option-${selected}`;
    const hasEmpty=options.some(option=>option.value==='');
    return <>
        <select {...props} ref={proxy} id={id?`${id}-control`:undefined} value={selected<0?'':raw} aria-hidden='true' tabIndex={-1} className='pointer-events-none sr-only'
            onInvalid={event=>{event.preventDefault();onInvalidMessage?.(event.currentTarget.validationMessage);if(isFirstInvalid(event.currentTarget))trigger.current?.focus();props.onInvalid?.(event);}}>
            {!hasEmpty&&<option value='' disabled>{placeholder}</option>}{children}
        </select>
        <Select.Root value={encoded} open={open} onOpenChange={setOpen} disabled={props.disabled}
            onValueChange={key=>{const option=options[Number(key.replace('option-',''))];if(option&&!option.disabled&&proxy.current&&!proxy.current.matches(':disabled'))changeNativeValue(proxy.current,option.value);}}>
            <Select.Trigger ref={trigger} id={id} aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}
                aria-invalid={props['aria-invalid']} aria-required={props.required||undefined} data-value={selected<0?'':raw} autoFocus={props.autoFocus} tabIndex={props.tabIndex}
                className={ui('inline-flex min-w-0 items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60',className)}
                onBlur={()=>{if(!open&&proxy.current)blurNativeControl(proxy.current);}}>
                <Select.Value placeholder={placeholder} className='block min-w-0 flex-1 truncate' /><Select.Icon className='shrink-0 text-muted'><ChevronDown size={16} aria-hidden='true' /></Select.Icon>
            </Select.Trigger>
            <Select.Portal><Select.Content position='popper' sideOffset={6} collisionPadding={12} className='z-[1600] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-[0_18px_52px_#0f172a26] outline-none backdrop-blur-xl dark:shadow-[0_18px_52px_#00000055]'>
                <Select.ScrollUpButton className='flex h-6 items-center justify-center text-muted'><ChevronUp size={16} aria-hidden='true' /></Select.ScrollUpButton>
                <Select.Viewport className='max-h-[min(320px,var(--radix-select-content-available-height))] p-1.5 [scrollbar-width:thin]'>
                    {options.map((option,index)=><Select.Item key={`${option.value}-${index}`} value={`option-${index}`} disabled={option.disabled} textValue={option.text} className='relative flex min-h-10 cursor-default items-center rounded-lg py-2.5 pr-3 pl-8 text-[13px] leading-relaxed outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary data-[state=checked]:font-semibold'>
                        <Select.ItemIndicator className='absolute left-2 text-primary'><Check size={15} aria-hidden='true' /></Select.ItemIndicator><Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>)}
                </Select.Viewport>
                <Select.ScrollDownButton className='flex h-6 items-center justify-center text-muted'><ChevronDown size={16} aria-hidden='true' /></Select.ScrollDownButton>
            </Select.Content></Select.Portal>
        </Select.Root>
    </>;
}
