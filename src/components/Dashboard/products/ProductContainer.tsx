import {totalAmounts} from '../../../utils/overview';
import {money} from '../../../utils/indiaBilling';
import { ui } from '../../../styles/ui';
import { Plus as AddIcon, Search, Package as LocalMallRoundedIcon } from 'lucide-react';
import { Button, Typography, InputAdornment, Paper, Toolbar } from '../../ui/primitives';
import { useAppSelector as useSelector } from '../../../Redux/hooks';
import type { Product } from '../../../types/domain';
import React, { useEffect, useMemo, useState } from 'react';
import ProductList from './ProductList';

import Input from '../../controls/Input';
import Popup from '../../Popup';

import ProductForm from './ProductForm';

import StockDesk from '../StockDesk';
import { catalogReview } from '../../../utils/catalogReview';

export default function ProductContainer() {
    const [openPopup, setOpenPopup] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState<Product[]>([]);
    const [qualityFilter, setQualityFilter] = useState('All');
    const products = useSelector((state) => state.products);
    const catalogValue = totalAmounts(products.map(product=>product.price));
    const averagePrice = products.length ? catalogValue / products.length : 0;
    const reviewed = useMemo(() => catalogReview(products), [products]);

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        const results = reviewed.filter(({ product, issues }) => (qualityFilter === 'All' || issues.includes(qualityFilter)) && `${product.name} ${product.sku || ''} ${product.category || ''}`.toLowerCase().includes(query)).map(record => record.product);
        setSearchResult(results);
    }, [reviewed, qualityFilter, searchInput]);

    return (
        <section className={ui("workspace-page page-enter")}>
            <header className={ui("workspace-hero catalog-workspace-hero")}>
                <div className={ui("workspace-hero-copy")}>
                    <span className={ui("workspace-kicker")}><LocalMallRoundedIcon /> Catalog &amp; stock</span>
                    <h1>Product catalog</h1>
                    <p>A polished, searchable home for everything you sell.</p>
                </div>
                <div className={ui("workspace-hero-stats")}>
                    <div><span>Total products</span><strong>{products.length}</strong></div>
                    <div><span>Average price</span><strong>{money(averagePrice)}</strong></div>
                    <div><span>Sum of list prices</span><strong>{money(catalogValue)}</strong></div>
                </div>
            </header>
            <StockDesk />
            <Paper className={ui("data-panel surface-card")} elevation={0}>
                <div className={ui("catalog-quality")}><span className={ui("workspace-kicker")}>CATALOG QUALITY</span><h2>Make products easier to find and count.</h2><p>Review optional catalog details. These are setup suggestions, not tax-compliance checks.</p><div className={ui("invoice-tabs")} role='group' aria-label='Catalog quality filters'>{['All', 'Missing SKU', 'Duplicate SKU', 'Missing unit', 'Missing category'].map(value => <button key={value} className={ui(qualityFilter === value ? 'selected' : '')} aria-pressed={qualityFilter === value} onClick={() => setQualityFilter(value)}>{value}<span>{value === 'All' ? products.length : reviewed.filter(record => record.issues.includes(value)).length}</span></button>)}</div></div>
                <div>
                    <Toolbar className={ui("data-toolbar")}>
                        <Input
                            label="Search products"
                            size="small"
                            value={searchInput}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                ),
                            }}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <Button
                            variant="outlined"
                            size="large"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setOpenPopup(true);
                            }}
                        >
                            Add product
                        </Button>
                    </Toolbar>
                </div>
                <div>
                    {products.length > 0 ? (
                        searchResult.length ? <ProductList searchResult={searchResult} /> : <p className={ui("finance-empty")}>No products match this search and quality filter.</p>
                    ) : (
                        <Typography
                            variant="h5"
                            color="textSecondary"
                            gutterBottom
                            className={ui("empty-state")}
                        >
                            No products yet. Add your first product to get started.
                        </Typography>
                    )}
                </div>
            </Paper>
            <Popup title="Catalog studio" size='editor' openPopup={openPopup} setOpenPopup={setOpenPopup}>
                <ProductForm setOpenPopup={setOpenPopup} />
            </Popup>
        </section>
    );
}
