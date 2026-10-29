import { ui } from '../../../styles/ui';
import { Pencil as EditTwoToneIcon, Trash2 as DeleteIcon, Package as LocalMallRoundedIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '../../ui/primitives';
import { useAppDispatch as useDispatch } from '../../../Redux/hooks';
import type { Product } from '../../../types/domain';
import type { Confirmation } from '../../ConfirmAction';
import React, { useState } from 'react';

import { removeProducts } from '../../../Redux/Actions/productAction';

import ConfirmDialog from './ConfirmDialog';
import Popup from '../../Popup';
import ActionButton from '../../controls/ActionButton';
import ProductForm from './ProductForm';

const ProductList = ({ searchResult }: { searchResult: Product[] }) => {
    const dispatch = useDispatch();
    const [openPopup, setOpenPopup] = useState(false);
    const [editData, setEditData] = useState<Product | null>(null);
    const [toggle, setToggle] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<Confirmation>({
        isOpen: false,
        title: '',
        subTitle: '',
    });

    const handleToggle = () => {
        setToggle(!toggle);
        setOpenPopup(true);
    };

    const handleRemove = (_id: string) => {
        setConfirmDialog({
            ...confirmDialog,
            isOpen: false,
        });
        dispatch(removeProducts(_id));
    };

    const handleEdit = (data: Product) => {
        setEditData(data);
        handleToggle();
    };

    return (
        <>
            <TableContainer className={ui("max-h-[440px]")} >
                <Table className={ui("w-full")} >
                    <TableHead>
                        <TableRow>
                            <TableCell>PRODUCT NAME</TableCell>
                            <TableCell>PRICE</TableCell>
                            <TableCell>TAX DEFAULTS</TableCell>
                            <TableCell align='right'>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {searchResult.map(product => (
                            <TableRow key={product._id} hover>
                                <TableCell>
                                    <div className={ui("entity-cell")}>
                                        <span className={ui("entity-avatar product-avatar")}><LocalMallRoundedIcon /></span>
                                        <div><strong>{product.name}</strong><span>{product.sku || 'No SKU'} · {product.category || 'Uncategorised'}</span></div>
                                    </div>
                                </TableCell>
                                <TableCell><span className={ui("price-value")}>₹{Number(product.price).toLocaleString('en-IN')}</span><br /><small>per {product.unit || 'NOS'}</small></TableCell>
                                <TableCell><span>{product.gstRate === '' || product.gstRate == null ? 'GST not set' : product.gstRate + '% GST'}</span><br /><small>{product.hsn ? 'HSN/SAC ' + product.hsn : 'No HSN/SAC'}</small></TableCell>
                                <TableCell align='right'>
                                    <div className={ui("table-actions")}>
                                    <ActionButton
                                        aria-label={`Edit ${product.name}`}
                                        color="primary"
                                        onClick={() => handleEdit(product)}
                                    >
                                        <EditTwoToneIcon />
                                    </ActionButton>
                                    <ActionButton
                                        aria-label={`Delete ${product.name}`}
                                        color="secondary"
                                        onClick={() => {
                                            setConfirmDialog({
                                                isOpen: true,
                                                title: 'Are you sure to delete this record?',
                                                subTitle: 'Items linked to invoices cannot be deleted. Otherwise, this permanently removes the catalog record.',
                                                onConfirm: () => {
                                                    handleRemove(product._id);
                                                },
                                            });
                                        }}
                                    >
                                        <DeleteIcon />
                                    </ActionButton>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {editData && toggle ? (
            <Popup title='Catalog studio' size='editor' openPopup={openPopup} setOpenPopup={setOpenPopup}>
                    <ProductForm editData={editData} setOpenPopup={setOpenPopup} />
                </Popup>
            ) : null}
            <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
        </>
    );
};

export default ProductList;
