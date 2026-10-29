import React, { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ChangeEvent, FocusEvent, FormEvent, HTMLAttributes, InputHTMLAttributes, OptionHTMLAttributes, ReactNode, SelectHTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Slot } from '@radix-ui/react-slot';
import SelectControl from './SelectControl';
import {isFirstInvalid} from './nativeEvents';
import DateControl from './DateControl';
import { ui } from '../../styles/ui';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
    variant?: 'text' | 'outlined' | 'contained'; color?: 'primary' | 'secondary' | 'default' | 'inherit';
    size?: 'small' | 'medium' | 'large'; startIcon?: ReactNode; endIcon?: ReactNode; fullWidth?: boolean; asChild?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'text', color = 'default', size = 'medium', startIcon, endIcon, fullWidth, asChild, className, children, type = 'button', ...props }, ref) {
    const classes = ui('ui-button inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[18px] motion-reduce:transition-none',
        color === 'secondary' ? 'text-danger hover:bg-danger/10' : color === 'primary' ? 'text-primary hover:bg-primary/8' : 'text-ink hover:bg-primary-soft',
        variant === 'outlined' && 'border border-line hover:border-primary',
        variant === 'contained' && (color === 'secondary' ? 'bg-danger text-white shadow-sm hover:bg-danger/90' : 'bg-primary text-white shadow-sm hover:bg-primary/90 dark:text-[#181a31]'),
        size === 'small' && 'min-h-9 px-3 py-1.5 text-xs', size === 'large' && 'min-h-12 px-5 py-3', fullWidth && 'w-full', className);
    if (asChild && React.isValidElement<{children?: ReactNode}>(children)) return <Slot className={classes} {...props}>{React.cloneElement(children, {}, <>{startIcon}{children.props.children}{endIcon}</>)}</Slot>;
    return <button ref={ref} type={type} className={classes} {...props}>{startIcon}{children}{endIcon}</button>;
});
export type IconButtonProps = Omit<ButtonProps, 'startIcon' | 'endIcon' | 'variant'>;
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({className, size, children, ...props}, ref) {
    return <Button ref={ref} {...props} size={size} className={ui('ui-icon-button size-10 min-h-0 p-2 text-muted hover:bg-primary-soft [&_svg]:size-5 pointer-coarse:size-11', size === 'small' && 'size-9', className)}>{children}</Button>;
});

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'color' | 'value' | 'onChange' | 'onBlur' | 'onInvalid'> {
    label?: ReactNode; value?: string | number | readonly string[]; helperText?: ReactNode; error?: boolean;
    variant?: 'outlined' | 'standard' | 'filled'; size?: 'small' | 'medium'; fullWidth?: boolean; select?: boolean; multiline?: boolean; rows?: number;
    inputProps?: InputHTMLAttributes<HTMLInputElement>; InputLabelProps?: {shrink?: boolean}; InputProps?: {startAdornment?: ReactNode};
    onChange?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onInvalid?: (event: FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}
let fieldSequence = 0;
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({label, value, helperText, error, variant: _variant, size, fullWidth, select, multiline, rows = 3, inputProps = {}, InputLabelProps: _labelProps, InputProps, className, id, onChange, children, type = 'text', ...props}, ref) {
    const [generatedId] = useState(() => `workspace-field-${++fieldSequence}`);
    const fieldId = id || generatedId;
    const [validation,setValidation]=useState('');
    useEffect(()=>setValidation(''),[value]);
    const invalid=error||Boolean(validation);
    const help=error?helperText:validation||helperText;
    const describedBy = help ? `${fieldId}-help` : props['aria-describedby'];
    const common = { id: fieldId, value,
        onChange:(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>{setValidation('');onChange?.(event);},
        onBlur:(event:FocusEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>{setValidation(event.currentTarget.validity.valid?'':event.currentTarget.validationMessage);props.onBlur?.(event);},
        onInvalid:(event:FormEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>{event.preventDefault();setValidation(event.currentTarget.validationMessage);if(event.currentTarget.getAttribute('aria-hidden')!=='true'&&isFirstInvalid(event.currentTarget))event.currentTarget.focus();props.onInvalid?.(event);},
        'aria-invalid': invalid || undefined, 'aria-describedby': describedBy,
        className: ui('ui-input w-full min-w-0 flex-1 border-0 bg-transparent px-3.5 py-3 text-[.875rem] text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 appearance-none', type==='number'&&'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'),
    };
    return <div className={ui('ui-field grid min-w-0 content-start gap-2', fullWidth && 'w-full', className)}>
        {label && <label htmlFor={fieldId} className={ui('ui-label block max-w-full truncate text-[.8rem] font-medium text-muted', invalid && 'text-danger')}>{label}{props.required && <span aria-hidden='true'> *</span>}</label>}
        <div className={ui('ui-input-shell flex min-w-0 items-center overflow-hidden rounded-[10px] border border-line bg-field transition-shadow focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15', invalid && 'border-danger focus-within:border-danger focus-within:ring-danger/15', size === 'small' && '[&_.ui-input]:py-2.5')}>
            {InputProps?.startAdornment}
            {select ? <SelectControl {...props as SelectHTMLAttributes<HTMLSelectElement>} {...common} onInvalidMessage={setValidation} placeholder={typeof label==='string'?`Select ${label.toLowerCase()}`:'Choose an option'} className={common.className}>{children}</SelectControl> : multiline ? <textarea {...props as TextareaHTMLAttributes<HTMLTextAreaElement>} {...inputProps as TextareaHTMLAttributes<HTMLTextAreaElement>} {...common} rows={rows} /> : type==='date' ? <DateControl ref={ref} {...props} {...inputProps} {...common} fieldLabel={typeof label==='string'?label:'date'} /> : <input ref={ref} type={type} {...props} {...inputProps} {...common} />}
        </div>
        {help && <p id={`${fieldId}-help`} role={invalid?'alert':undefined} className={ui('ui-field-help text-xs leading-relaxed text-muted', invalid && 'text-danger')}>{help}</p>}
    </div>;
});
export const MenuItem = (props: OptionHTMLAttributes<HTMLOptionElement>) => <option {...props} />;
export function Tooltip({children, title}: {children: ReactNode; title: ReactNode; arrow?: boolean}) {
    const anchor = useRef<HTMLSpanElement>(null);
    const [position, setPosition] = useState<{left: number; top: number; below: boolean} | null>(null);
    const show = () => { const rect = anchor.current?.getBoundingClientRect(); if (rect) setPosition({left: Math.max(132, Math.min(rect.left + rect.width / 2, window.innerWidth - 132)), top: rect.top < 60 ? rect.bottom + 8 : rect.top - 8, below: rect.top < 60}); };
    return <span ref={anchor} className='inline-flex min-w-0 align-middle' onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)} onClick={() => setPosition(null)}>{children}{position && createPortal(<span role='tooltip' style={{left: position.left, top: position.top}} className={ui('pointer-events-none fixed z-[1500] w-max max-w-[min(240px,calc(100vw-24px))] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-center text-xs text-canvas shadow-lg', !position.below && '-translate-y-full')}>{title}</span>, document.body)}</span>;
}
export function Switch({color: _color, className, ...props}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {color?: string}) {
    return <span className='relative inline-flex shrink-0 items-center'><input type='checkbox' {...props} className={ui('peer sr-only', className)} /><span aria-hidden='true' className='h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-primary peer-disabled:opacity-40 after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5' /></span>;
}
export const FormControlLabel = ({control, label}: {control: ReactNode; label: ReactNode}) => <label className='my-3 flex cursor-pointer items-center gap-3 text-sm leading-relaxed text-ink'>{control}<span>{label}</span></label>;
export function LinearProgress({value = 0}: {value?: number; variant?: string}) { return <progress aria-label='Profile completeness' max={100} value={value} className='h-1.5 w-full overflow-hidden rounded-full border-0 [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary' />; }
export const DialogTitle = ({className, disableTypography, ...props}: HTMLAttributes<HTMLElement> & {disableTypography?: boolean}) => disableTypography ? <div {...props} className={ui('ui-dialog-title px-6 py-5 text-lg font-bold text-ink', className)} /> : <h2 {...props} className={ui('ui-dialog-title px-6 py-5 text-lg font-bold text-ink', className)} />;
export const DialogContent = ({className, ...props}: HTMLAttributes<HTMLDivElement>) => <div {...props} className={ui('ui-dialog-content min-w-0 px-6 py-4 text-sm leading-relaxed wrap-anywhere text-ink', className)} />;
export const DialogActions = ({className, ...props}: HTMLAttributes<HTMLDivElement>) => <div {...props} className={ui('ui-dialog-actions flex flex-wrap justify-end gap-2 px-6 py-4', className)} />;
export const Paper = ({className, elevation: _elevation, ...props}: HTMLAttributes<HTMLDivElement> & {elevation?: number}) => <div {...props} className={ui('ui-paper rounded-xl border border-line bg-surface', className)} />;
export const Toolbar = ({className, ...props}: HTMLAttributes<HTMLDivElement>) => <div {...props} className={ui('flex min-h-14 flex-wrap items-center gap-4 px-6 py-4', className)} />;
export const InputAdornment = ({children}: {children: ReactNode; position?: string}) => <span className='flex items-center pl-3 text-muted [&_svg]:size-5'>{children}</span>;
export const Typography = ({className, variant, color, gutterBottom, ...props}: HTMLAttributes<HTMLParagraphElement> & {variant?: string; color?: string; gutterBottom?: boolean}) => <p {...props} className={ui(variant?.startsWith('h') && 'text-lg font-semibold', color === 'textSecondary' && 'text-muted', gutterBottom && 'mb-3', className)} />;
const TableHeadContext = createContext(false);
export const Table = ({className, ...props}: TableHTMLAttributes<HTMLTableElement>) => <table {...props} className={ui('ui-table mt-6 w-full border-collapse text-left text-sm', className)} />;
export const TableHead = ({children}: HTMLAttributes<HTMLTableSectionElement>) => <TableHeadContext.Provider value={true}><thead className='bg-field text-xs font-semibold text-muted'>{children}</thead></TableHeadContext.Provider>;
export const TableBody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} className={ui('ui-table-body', props.className)} />;
export const TableRow = ({className, hover, ...props}: HTMLAttributes<HTMLTableRowElement> & {hover?: boolean}) => <tr {...props} className={ui(hover && 'transition-colors hover:bg-primary-soft/40', className)} />;
export function TableCell({className, align, ...props}: TdHTMLAttributes<HTMLTableCellElement>) {
    const head = useContext(TableHeadContext); const Tag = head ? 'th' : 'td';
    return <Tag {...props} scope={head ? 'col' : undefined} className={ui('ui-table-cell border-b border-line px-4 py-4 align-middle', align === 'right' && 'text-right', className)} />;
}
export const TableContainer = ({className, ...props}: HTMLAttributes<HTMLDivElement>) => <div {...props} className={ui('ui-table-container w-full overflow-auto', className)} />;
export function TablePagination({count, page, rowsPerPage, rowsPerPageOptions, onPageChange, onRowsPerPageChange}: {component?: string; count: number; page: number; rowsPerPage: number; rowsPerPageOptions: number[]; onPageChange: (event: React.MouseEvent<HTMLButtonElement>, page: number) => void; onRowsPerPageChange: (event: ChangeEvent<HTMLSelectElement>) => void}) {
    const total = Math.max(1, Math.ceil(count / rowsPerPage));
    return <nav aria-label='Invoice pagination' className='flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3 text-xs text-muted'><label className='flex items-center gap-2'>Rows per page<SelectControl aria-label='Rows per page' value={rowsPerPage} onChange={onRowsPerPageChange} className='min-w-16 rounded-lg border border-line bg-field px-2.5 py-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-primary'>{rowsPerPageOptions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</SelectControl></label><span>{count ? page * rowsPerPage + 1 : 0}–{Math.min((page + 1) * rowsPerPage, count)} of {count}</span><Button size='small' disabled={page <= 0} aria-label='Previous page' onClick={event => onPageChange(event, page - 1)}>Previous</Button><Button size='small' disabled={page + 1 >= total} aria-label='Next page' onClick={event => onPageChange(event, page + 1)}>Next</Button></nav>;
}
