import type { CSSProperties } from 'react';
import { ui, stagger } from '../../../styles/ui';
import { useAppSelector as useSelector } from '../../../Redux/hooks';

import { getMonthlySales } from '../../../utils/billing';

const BarChart = () => {
    const { bills } = useSelector(state => state.bills);
    const chartData = getMonthlySales(bills);
    const maximum = Math.max(...chartData.map(([, value]) => value), 1);

    return (
        <div className={ui("secure-chart")} role='img' aria-label='Invoice totals including tax for the last six months'>
            <div className={ui("secure-chart-grid")} aria-hidden='true'><span /><span /><span /><span /></div>
            <div className={ui("secure-chart-bars")}>
                {chartData.map(([month, value], index) => (
                    <div className={ui("secure-chart-column", stagger[index])} key={month}>
                        <div className={ui("secure-chart-value")}>₹{Number(value).toLocaleString('en-IN')}</div>
                        <div className={ui("secure-chart-track")}>
                            <span className='h-[var(--plot-size)]' style={{ '--plot-size': `${Math.max((value / maximum) * 100, value ? 8 : 2)}%` } as CSSProperties} />
                        </div>
                        <div className={ui("secure-chart-label")}>{month}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BarChart;
