import {workspaceOverview} from './overview';
import {invoiceFixture,customerFixture} from '../testing/fixtures';

test('overview distinguishes issued value, reversed receipts, overdue balances and corrections',()=>{
    const bills=[
        invoiceFixture({_id:'partial',date:'2026-10-01',dueDate:'2026-10-10',total:100.1,payments:[{_id:'paid',date:'2026-10-02',amount:20.1,method:'Cash'},{_id:'reversed',date:'2026-10-03',amount:30,method:'Cash'}],reversals:[{paymentId:'reversed',date:'2026-10-04',amount:30,reason:'Wrong receipt'}]}),
        invoiceFixture({_id:'future',date:'2026-10-11',dueDate:'2026-11-01',total:0.2}),
        invoiceFixture({_id:'cancelled',total:1000,cancellation:{date:'2026-10-12',reason:'Void'}}),
        invoiceFixture({_id:'credited',total:2000,creditNote:{date:'2026-10-12',reason:'Return',number:'CN1',amount:2000}}),
    ];
    const overview=workspaceOverview(bills,[customerFixture({name:'Buyer'})],'2026-10-20');
    expect(overview).toMatchObject({invoiced:100.3,paid:20.1,outstanding:80.2,overdue:80,activeCount:2,openCount:2});
    expect(overview.overdueRows.map(row=>row._id)).toEqual(['partial']);
    expect(overview.recent[0]).toMatchObject({_id:'future',customerName:'Buyer'});
});
test('an empty workspace has genuine zero balances and no invented activity',()=>{
    expect(workspaceOverview([],[])).toMatchObject({invoiced:0,paid:0,outstanding:0,overdue:0,recent:[],overdueRows:[]});
});
