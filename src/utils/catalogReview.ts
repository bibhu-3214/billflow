import type { Product } from '../types/domain';
export const catalogReview = (products: Product[]) => {
    const counts = new Map<string, number>();
    const sku = (product: Product) => String(product.sku || '').trim().toLowerCase();
    products.forEach(product => { const key = sku(product); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
    return products.map(product => ({ product, issues: [
        ...(!sku(product) ? ['Missing SKU'] : []),
        ...((counts.get(sku(product)) || 0) > 1 ? ['Duplicate SKU'] : []),
        ...(!String(product.unit || '').trim() ? ['Missing unit'] : []),
        ...(!String(product.category || '').trim() ? ['Missing category'] : []),
    ] }));
};
