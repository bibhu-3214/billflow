import React, { useEffect, useMemo, useState } from 'react';
import ProductList from './ProductList';
import AddIcon from '@material-ui/icons/Add';
import Button from '@material-ui/core/Button';
import { Typography } from '@material-ui/core';
import { InputAdornment, Paper, Toolbar } from '@material-ui/core';
import Input from '../../controls/Input';
import Popup from '../../Popup';
import { Search } from '@material-ui/icons';
import { useSelector } from 'react-redux';
import ProductForm from './ProductForm';
import LocalMallRoundedIcon from '@material-ui/icons/LocalMallRounded';
import StockDesk from '../StockDesk';
import { catalogReview } from '../../../utils/catalogReview';

export default function ProductContainer() {
    const [openPopup, setOpenPopup] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [qualityFilter, setQualityFilter] = useState('All');
    const products = useSelector((state) => state.products);
    const catalogValue = products.reduce((sum, product) => sum + Number(product.price || 0), 0);
    const averagePrice = products.length ? Math.round(catalogValue / products.length) : 0;
    const reviewed = useMemo(() => catalogReview(products), [products]);

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        const results = reviewed.filter(({ product, issues }) => (qualityFilter === 'All' || issues.includes(qualityFilter)) && `${product.name} ${product.sku || ''} ${product.category || ''}`.toLowerCase().includes(query)).map(record => record.product);
        setSearchResult(results);
    }, [reviewed, qualityFilter, searchInput]);

    return (
        <section className='workspace-page page-enter'>
            <header className='workspace-hero catalog-workspace-hero'>
                <div className='workspace-hero-copy'>
                    <span className='workspace-kicker'><LocalMallRoundedIcon /> Catalog &amp; stock</span>
                    <h1>Product catalog</h1>
                    <p>A polished, searchable home for everything you sell.</p>
                </div>
                <div className='workspace-hero-stats'>
                    <div><span>Total products</span><strong>{products.length}</strong></div>
                    <div><span>Average price</span><strong>₹{averagePrice.toLocaleString('en-IN')}</strong></div>
                    <div><span>Sum of list prices</span><strong>₹{catalogValue.toLocaleString('en-IN')}</strong></div>
                </div>
            </header>
            <StockDesk />
            <Paper className='data-panel surface-card' elevation={0}>
                <div className='catalog-quality'><span className='workspace-kicker'>CATALOG QUALITY</span><h2>Make products easier to find and count.</h2><p>Review optional catalog details. These are setup suggestions, not tax-compliance checks.</p><div className='invoice-tabs' role='group' aria-label='Catalog quality filters'>{['All', 'Missing SKU', 'Duplicate SKU', 'Missing unit', 'Missing category'].map(value => <button key={value} className={qualityFilter === value ? 'selected' : ''} aria-pressed={qualityFilter === value} onClick={() => setQualityFilter(value)}>{value}<span>{value === 'All' ? products.length : reviewed.filter(record => record.issues.includes(value)).length}</span></button>)}</div></div>
                <div>
                    <Toolbar className='data-toolbar'>
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
                        searchResult.length ? <ProductList searchResult={searchResult} /> : <p className='finance-empty'>No products match this search and quality filter.</p>
                    ) : (
                        <Typography
                            variant="h5"
                            color="textSecondary"
                            gutterBottom
                            className='empty-state'
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
