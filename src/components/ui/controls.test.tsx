import React, {useState} from 'react';
import type {FormEvent} from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {TextField,MenuItem} from './primitives';
import {chooseOption} from '../../testing/chooseOption';

function SelectFixture({empty=false}: {empty?:boolean}) {
    const [value,setValue]=useState('');
    return <><TextField select id='fixture' name='state' label='State' required={!empty} value={value} onChange={event=>setValue(event.target.value)}>{empty&&<MenuItem value=''>Not set</MenuItem>}<MenuItem value='MH'>Maharashtra</MenuItem><MenuItem value='KA'>Karnataka</MenuItem><MenuItem value='disabled' disabled>Unavailable</MenuItem></TextField><output aria-label='Saved value'>{value||'empty'}</output></>;
}
test('dropdown selections use real form values, disable unavailable options and allow explicit empty choices',()=>{
    render(<SelectFixture empty />);
    expect(screen.getByRole('combobox',{name:'State'})).toHaveTextContent('Not set');
    chooseOption('State','Maharashtra');expect(screen.getByLabelText('Saved value')).toHaveTextContent('MH');
    fireEvent.keyDown(screen.getByRole('combobox'),{key:'ArrowDown'});
    expect(screen.getByRole('option',{name:'Unavailable'})).toHaveAttribute('aria-disabled','true');
    fireEvent.keyDown(screen.getByRole('option',{name:'Not set'}),{key:'Enter'});
    expect(screen.getByLabelText('Saved value')).toHaveTextContent('empty');
});
test('required dropdowns block submission and keep the error inside the styled field',()=>{
    const submit=jest.fn((event:FormEvent)=>event.preventDefault());
    render(<form onSubmit={submit}><SelectFixture /><button type='submit'>Save</button></form>);
    fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid','true');
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
    chooseOption('State','Karnataka');fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(submit).toHaveBeenCalledTimes(1);
});
function DateFixture() {
    const [value,setValue]=useState('2024-02-28');
    return <TextField label='Invoice date' type='date' required name='date' value={value} inputProps={{min:'2024-02-01',max:'2024-03-10'}} onChange={event=>setValue(event.target.value)} />;
}
test('calendar picks preserve ISO dates and typed invalid dates remain blocked',async()=>{
    const submit=jest.fn((event:FormEvent)=>event.preventDefault());
    render(<form onSubmit={submit}><DateFixture /><button type='submit'>Save</button></form>);
    fireEvent.click(screen.getByRole('button',{name:'Choose Invoice date'}));
    const day=await screen.findByRole('button',{name:/February 29.*2024/});fireEvent.click(day);
    await waitFor(()=>expect(screen.getByRole('textbox',{name:'Invoice date'})).toHaveValue('2024-02-29'));
    fireEvent.change(screen.getByRole('textbox',{name:'Invoice date'}),{target:{value:'2023-02-29'}});
    fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('real date');
    fireEvent.change(screen.getByRole('textbox',{name:'Invoice date'}),{target:{value:'2024-03-20'}});
    fireEvent.click(screen.getByRole('button',{name:'Save'}));expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('2024-03-10 or earlier');
});
