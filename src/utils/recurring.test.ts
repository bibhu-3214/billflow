import { nextReviewDate, recurrenceAnchor } from './recurring';
import { addCartItem } from './cart';
import { productFixture } from '../testing/fixtures';
test('monthly review dates keep their anchor through short and leap months',()=>{
 expect(nextReviewDate('2026-01-31','monthly',31,'2026-01-31')).toBe('2026-02-28');
 expect(nextReviewDate('2026-02-28','monthly',31,'2026-02-28')).toBe('2026-03-31');
 expect(nextReviewDate('2028-01-31','monthly',31,'2028-01-31')).toBe('2028-02-29');
 expect(nextReviewDate('2020-01-31','monthly',31,'2026-10-31')).toBe('2026-11-30');
 expect(nextReviewDate('2026-10-01','weekly',1,'2026-10-31')).toBe('2026-11-05');
 expect(()=>nextReviewDate('2026-02-30','monthly',1,'2026-10-31')).toThrow();
});
test('repeated scans merge unchanged catalogue lines while preserving edited prices/discounts',()=>{
 const product=productFixture({_id:'p',name:'Service',price:100});
 const first=addCartItem([],product,1);const next=addCartItem(first,product,2);
 expect(next).toHaveLength(1);expect(next[0].quantity).toBe(3);expect(first[0].quantity).toBe(1);
 expect(addCartItem([{...first[0],discount:10}],product,1)).toHaveLength(2);
 expect(addCartItem(first,{...product,price:120},1)).toHaveLength(2);
 const full=Array.from({length:100},(_,i)=>({...first[0],product:i===0?'p':String(i)}));
 expect(addCartItem(full,product,1)).toHaveLength(100);
 expect(()=>addCartItem(full,{...product,_id:'new'},1)).toThrow('100 lines');
 expect(()=>addCartItem([{...first[0],quantity:10000}],product,1)).toThrow('10,000');
});

test('editing a monthly plan name does not change its month-end anchor',()=>{
 const previous={dueDate:'2026-02-28',recurrence:{invoiceId:'invoice',cadence:'monthly' as const,anchorDay:31}};
 expect(recurrenceAnchor('2026-02-28','monthly',previous)).toBe(31);
 expect(recurrenceAnchor('2026-03-15','monthly',previous)).toBe(15);
 expect(recurrenceAnchor('2026-02-28','weekly',previous)).toBe(28);
});
