import {dateString,localDate} from './dateValues';

test.each(['2024-02-29','2026-10-29','0001-01-01','0099-12-31','9999-12-31'])('calendar date %s round-trips without UTC conversion',value=>{
    const date=localDate(value);expect(date).toBeDefined();if(date)expect(dateString(date)).toBe(value);
});
test.each(['2023-02-29','2024-02-30','2024-13-01','2024-00-01','2024-01-00','0000-01-01','2024-2-1','2024-02-29T00:00:00Z',''])('calendar date %s rejects impossible or non-ISO input',value=>{
    expect(localDate(value)).toBeUndefined();
});
