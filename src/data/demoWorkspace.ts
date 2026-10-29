// Fictional records only; this workspace never uses the persistent account database.
export const createDemoWorkspace = (now = new Date()) => {
    const customers = ['Northstar Studio', 'Cedar Creative', 'Orbit Design'].map((name, i) => ({
        _id: `demo_customer_${i}`, name, email: `studio${i}@example.com`, mobile: `900000000${i}`,
    }));
    const products = [
        { _id: 'demo_product_0', name: 'Interface design workshop', price: 12000 },
        { _id: 'demo_product_1', name: 'Frontend consultation', price: 4500 },
        { _id: 'demo_product_2', name: 'Component review', price: 2500 },
        { _id: 'demo_product_3', name: 'Accessibility review', price: 8000 },
    ];
    const bills = Array.from({ length: 6 }, (_, index) => {
        const product = products[index % products.length];
        const quantity = index % 3 + 1;
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1, 12).toISOString();
        return {
            _id: `demo_invoice_${index}`, date, createdAt: date,
            customer: customers[index % customers.length]._id,
            lineItems: [{ _id: `demo_item_${index}`, product: product._id, quantity, price: product.price, subTotal: product.price * quantity }],
            total: product.price * quantity,
        };
    });
    return { customers, products, bills };
};
