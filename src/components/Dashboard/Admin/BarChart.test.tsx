import {chooseOption} from '../../../testing/chooseOption';
import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import {useAppSelector} from '../../../Redux/hooks';
import {createRootState} from '../../../testing/fixtures';
import BarChart from './BarChart';
jest.mock('../../../Redux/hooks',()=>({useAppSelector:jest.fn()}));
test('chart period and month selection change the actual figures, with an accessible table',()=>{
    jest.useFakeTimers();jest.setSystemTime(new Date('2026-01-20T12:00:00Z'));
    try{
        jest.mocked(useAppSelector).mockImplementation(select=>select(createRootState({bills:{bills:[{date:'2025-12-15',total:100},{date:'2026-01-10',total:50}]}})));
        render(<BarChart />);
        expect(screen.getAllByRole('button',{pressed:false})).toHaveLength(5);
        fireEvent.click(screen.getByRole('button',{name:/Dec 2025/}));
        expect(screen.getByRole('button',{name:/Dec 2025/})).toHaveAttribute('aria-pressed','true');
        expect(screen.getByText('Selected month · Dec 2025')).toBeInTheDocument();
        chooseOption('Chart period','Last 3 months');
        expect(screen.getAllByRole('button')).toHaveLength(3);
        fireEvent.click(screen.getByText('View monthly figures'));
        expect(screen.getByRole('table')).toHaveAccessibleName('Invoice value by month, including tax');
    }finally{jest.useRealTimers();}
});
