import React, { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Search, ScanLine } from 'lucide-react';
import { Button, InputAdornment, MenuItem, TextField } from '../../ui/primitives';
import type { Product } from '../../../types/domain';
import { money } from '../../../utils/indiaBilling';

interface InvoiceItemPickerProps {
    products: readonly Product[];
    onAdd: (product: Product, quantity: number) => boolean;
    disabled?: boolean;
    limitReached?: boolean;
}
const normalize = (value: string) => value.trim().toLowerCase();

export default function InvoiceItemPicker({ products, onAdd, disabled = false, limitReached = false }: InvoiceItemPickerProps) {
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [problem, setProblem] = useState('');
    const [notice, setNotice] = useState('');
    const search = useRef<HTMLInputElement>(null);
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const matches = products.filter(product => tokens.every(token =>
        `${product.name} ${product.sku || ''} ${product.category || ''}`.toLowerCase().includes(token)));
    const selected = matches.find(product => product._id === selectedId) ||
        (tokens.length > 0 && matches.length === 1 ? matches[0] : undefined);
    const unavailable = disabled || limitReached;
    const add = () => {
        if (unavailable) return;
        setProblem(''); setNotice('');
        const amount = Number(quantity);
        if (!quantity.trim() || !Number.isInteger(amount) || amount < 1 || amount > 10000) {
            setProblem('Enter a whole quantity from 1 to 10,000.');
            return;
        }
        let product = selected;
        if (!product && normalize(query)) {
            const exactCodes = products.filter(item => item.sku && normalize(item.sku) === normalize(query));
            if (exactCodes.length > 1) {
                setProblem('More than one item uses this SKU. Choose the intended product below.');
                return;
            }
            product = exactCodes[0] || (matches.length === 1 ? matches[0] : undefined);
        }
        if (!product) {
            setProblem(matches.length ? 'Choose a product below, or enter a more specific name or SKU.' : 'No matching item. Try another name or SKU.');
            return;
        }
        if (!onAdd(product, amount)) {
            setProblem('This item could not be added. Your selection is still here.');
            return;
        }
        setNotice(`Added ${amount} × ${product.name}. Review the line items and totals below.`);
        setQuery(''); setSelectedId(''); setQuantity('1');
        search.current?.focus();
    };
    const enter = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat && !event.nativeEvent.isComposing) add();
    };
    return <div className='mb-5 min-w-0 rounded-xl border border-line bg-field p-3 sm:p-4' role='group' aria-label='Add invoice items'>
        <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-ink'><ScanLine size={18} aria-hidden='true' />Find an item. Keep billing.</div>
        <TextField ref={search} id='invoice-item-search' label='Search items or scan SKU' type='search' autoComplete='off' value={query} disabled={unavailable}
            inputProps={{ maxLength: 120 }} InputProps={{startAdornment: <InputAdornment><Search className='mr-2' size={18} aria-hidden='true' /></InputAdornment>}}
            helperText='Search name, SKU or category. Press Enter to add a unique match.'
            onChange={event => {setQuery(event.target.value); setSelectedId(''); setProblem(''); setNotice('');}} onKeyDown={enter} />
        <div className='mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_112px_auto]'>
            <TextField id='invoice-product' className='col-span-2 sm:col-span-1' select fullWidth size='small' label='Product' value={selected?._id || ''} disabled={unavailable || !matches.length}
                onChange={event => {setSelectedId(event.target.value); setProblem(''); setNotice('');}}>
                {matches.map(product => <MenuItem key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ''} · {money(product.price)}</MenuItem>)}
            </TextField>
            <TextField id='invoice-add-quantity' label='Quantity to add' type='number' size='small' value={quantity} disabled={unavailable}
                inputProps={{min: 1, max: 10000, step: 1}} onChange={event => {setQuantity(event.target.value); setProblem(''); setNotice('');}} onKeyDown={enter} />
            <Button type='button' variant='contained' color='primary' className='mt-[27px]' disabled={unavailable || !matches.length || (!selected && !normalize(query))} onClick={add}>Add</Button>
        </div>
        {limitReached ? <p role='status' className='mt-3 text-xs text-muted'>The 100-line limit is reached. Remove a line before adding another item.</p> : !products.length ? <p role='status' className='mt-3 text-xs text-muted'>Add products to your catalog before preparing line items.</p> : query && <p className='mt-3 text-xs text-muted'>{matches.length} matching {matches.length === 1 ? 'item' : 'items'}</p>}
        {problem && <p role='alert' className='mt-3 text-sm wrap-anywhere text-danger'>{problem}</p>}
        {notice && <p role='status' className='mt-2 text-xs leading-relaxed wrap-anywhere text-success'>{notice}</p>}
    </div>;
}
