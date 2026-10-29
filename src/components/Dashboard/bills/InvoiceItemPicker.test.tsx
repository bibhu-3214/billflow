import {chooseOption} from '../../../testing/chooseOption';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import type {Product} from '../../../types/domain';
import InvoiceItemPicker from './InvoiceItemPicker';

const products: Product[] = [
    {_id:'box', name:'Packaging box', sku:'00123', category:'Supplies', price:25, unit:'NOS'},
    {_id:'service', name:'Consulting', sku:'CONSULT', category:'Services', price:100, unit:'HRS'},
    {_id:'name-collision', name:'00123 deluxe box', sku:'OTHER', price:80},
];
const search = () => screen.getByRole('searchbox', {name:'Search items or scan SKU'});

test('a scanner code preserves leading zeros and prefers an exact SKU over matching names', () => {
    const onAdd = jest.fn(() => true), submit = jest.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    render(<form onSubmit={submit}><InvoiceItemPicker products={products} onAdd={onAdd} /><button type='submit'>Issue</button></form>);
    fireEvent.change(search(), {target:{value:'00123'}});
    fireEvent.change(screen.getByLabelText('Quantity to add'), {target:{value:'3'}});
    fireEvent.keyDown(search(), {key:'Enter'});
    expect(onAdd).toHaveBeenCalledWith(products[0],3);
    expect(submit).not.toHaveBeenCalled();
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
    expect(screen.getByLabelText('Quantity to add')).toHaveValue(1);
    expect(screen.getByText(/Added 3 × Packaging box/)).toBeInTheDocument();
});
test('search covers names, categories and SKU, with an explicit product choice', () => {
    const onAdd = jest.fn(() => true);
    render(<InvoiceItemPicker products={products} onAdd={onAdd} />);
    fireEvent.change(search(), {target:{value:'services consult'}});
    expect(screen.queryByRole('option',{name:/Packaging box/})).not.toBeInTheDocument();
    expect(screen.getByRole('combobox',{name:'Product'})).toHaveAttribute('data-value','service');
    chooseOption('Product',/^Consulting/);
    fireEvent.click(screen.getByRole('button',{name:'Add'}));
    expect(onAdd).toHaveBeenCalledWith(products[1],1);
});
test('duplicate normalized SKUs require an explicit selection', () => {
    const onAdd = jest.fn(() => true);
    render(<InvoiceItemPicker products={[products[0], {...products[1], sku:' 00123 '}]} onAdd={onAdd} />);
    fireEvent.change(search(),{target:{value:'00123'}});
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('More than one item uses this SKU');
    chooseOption('Product',/^Consulting/);
    fireEvent.click(screen.getByRole('button',{name:'Add'}));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({_id:'service'}),1);
});
test.each(['','0','1.5','10001'])('invalid quantity %s never adds a line', quantity => {
    const onAdd=jest.fn(() => true);
    render(<InvoiceItemPicker products={products} onAdd={onAdd} />);
    fireEvent.change(search(),{target:{value:'00123'}});
    fireEvent.change(screen.getByLabelText('Quantity to add'),{target:{value:quantity}});
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('whole quantity');
    expect(search()).toHaveValue('00123');
});
test('ambiguous names and missing codes never select an arbitrary item', () => {
    const onAdd=jest.fn(() => true);
    render(<InvoiceItemPicker products={products} onAdd={onAdd} />);
    fireEvent.change(search(),{target:{value:'box'}});
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a product');
    fireEvent.change(search(),{target:{value:'missing'}});
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(screen.getByRole('alert')).toHaveTextContent('No matching item');
    expect(onAdd).not.toHaveBeenCalled();
});
test('a rejected add retains search, selection and quantity for correction', () => {
    const onAdd=jest.fn(() => false);
    render(<InvoiceItemPicker products={products} onAdd={onAdd} />);
    fireEvent.change(search(),{target:{value:'consULT'}});
    fireEvent.change(screen.getByLabelText('Quantity to add'),{target:{value:'2'}});
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(onAdd).toHaveBeenCalledWith(products[1],2);
    expect(search()).toHaveValue('consULT');
    expect(screen.getByLabelText('Quantity to add')).toHaveValue(2);
    expect(screen.getByRole('alert')).toHaveTextContent('selection is still here');
});
test('the line limit blocks scanner input and button additions', () => {
    const onAdd=jest.fn(() => true);
    render(<InvoiceItemPicker products={products} onAdd={onAdd} limitReached />);
    expect(search()).toBeDisabled();
    expect(screen.getByRole('button',{name:'Add'})).toBeDisabled();
    fireEvent.keyDown(search(),{key:'Enter'});
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/100-line limit/)).toBeInTheDocument();
});
