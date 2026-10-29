import {fireEvent,screen} from '@testing-library/react';
export function chooseOption(label:string,option:string|RegExp) {
    fireEvent.keyDown(screen.getByRole('combobox',{name:label}),{key:'ArrowDown'});
    fireEvent.keyDown(screen.getByRole('option',{name:option}),{key:'Enter'});
}
