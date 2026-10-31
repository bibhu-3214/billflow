import type { InvoiceLineInput, Product } from '../types/domain';
const tax=(value:InvoiceLineInput['gstRate'])=>value===''||value==null?'':String(Number(value));
export function addCartItem(items:readonly InvoiceLineInput[],product:Product,quantity:number):InvoiceLineInput[] {
    if(!Number.isInteger(quantity)||quantity<1||quantity>10000)throw new Error('Enter a quantity from 1 to 10,000.');
    const index=items.findIndex(item=>item.product===product._id&&item.name===product.name&&Number(item.price)===product.price&&Number(item.discount||0)===0&&tax(item.gstRate)===tax(product.gstRate)&&(item.unit||'NOS')===(product.unit||'NOS')&&(item.hsn||'')===(product.hsn||''));
    if(index>=0){const amount=Number(items[index].quantity)+quantity;if(!Number.isInteger(amount)||amount>10000||amount<1)throw new Error('This item would exceed 10,000 units.');return items.map((item,i)=>i===index?{...item,quantity:amount}:item);}
    if(items.length>=100)throw new Error('This invoice supports 100 lines. Existing matching items can still be scanned.');
    return [...items,{product:product._id,name:product.name,price:product.price,quantity,discount:0,gstRate:product.gstRate??'',hsn:product.hsn||'',unit:product.unit||'NOS'}];
}
