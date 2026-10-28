import { useSelector } from 'react-redux';
import { getMonthlySales } from '../../../utils/billing';

const BarChart = () => {
    const { bills } = useSelector(state => state.bills);
    const chartData = getMonthlySales(bills);
    const maximum = Math.max(...chartData.map(([, value]) => value), 1);

    return (
        <div className='secure-chart' role='img' aria-label='Invoice totals including tax for the last six months'>
            <div className='secure-chart-grid' aria-hidden='true'><span /><span /><span /><span /></div>
            <div className='secure-chart-bars'>
                {chartData.map(([month, value], index) => (
                    <div className='secure-chart-column' style={{ animationDelay: `${index * 70}ms` }} key={month}>
                        <div className='secure-chart-value'>₹{Number(value).toLocaleString('en-IN')}</div>
                        <div className='secure-chart-track'>
                            <span style={{ height: `${Math.max((value / maximum) * 100, value ? 8 : 2)}%` }} />
                        </div>
                        <div className='secure-chart-label'>{month}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BarChart;
