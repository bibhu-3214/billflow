import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomerPicker from './CustomerPicker';
import {customerFixture} from '../../../testing/fixtures';
const customers=[customerFixture({_id:'a',name:'Asha',company:'North Traders',email:'asha@example.test',mobile:'9876543210',address:'Mumbai',gstin:'27ABCDE1234F1Z5'}),customerFixture({_id:'b',name:'Asha',company:'South Traders',email:'south@example.test'})];
test.each(['north','987654','asha@example.test','27abc'])('customer lookup selects a unique %s match only after Enter',query=>{
    const onSelect=jest.fn();render(<CustomerPicker customers={customers} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('searchbox',{name:'Find customer'}),{target:{value:query}});
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('searchbox'),{key:'Enter'});
    expect(onSelect).toHaveBeenCalledWith(customers[0]);
});
test('ambiguous names never silently replace the selected customer',()=>{
    const onSelect=jest.fn();render(<CustomerPicker customers={customers} value='a' onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Asha'}});fireEvent.keyDown(screen.getByRole('searchbox'),{key:'Enter'});
    expect(onSelect).not.toHaveBeenCalled();expect(screen.getByRole('combobox',{name:'Customer'})).toHaveAttribute('data-value','a');
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});
    expect(screen.getByRole('combobox',{name:'Customer'})).toHaveAttribute('data-value','a');expect(screen.getByText(/No matching profiles/)).toBeInTheDocument();
});
