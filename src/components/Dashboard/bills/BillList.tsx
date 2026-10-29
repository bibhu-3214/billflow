import { ui } from '../../../styles/ui';
import { Trash2 as DeleteIcon, Eye as VisibilityTwoToneIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, TablePagination } from '../../ui/primitives';
import { useAppSelector as useSelector, useAppDispatch as useDispatch } from '../../../Redux/hooks';
import type { Invoice } from '../../../types/domain';
import type { Confirmation } from '../../ConfirmAction';
import React, { useState, useEffect } from 'react';

import ConfirmDialog from './ConfirmDialog';
import ActionButton from '../../controls/ActionButton';
import { getBillById, removeBill } from '../../../Redux/Actions/billAction';

import Popup from '../../Popup';
import ShowBills from './ShowBills';
import { money, paymentSummary } from '../../../utils/indiaBilling';

const BillList = ({ searchResult }: { searchResult: Invoice[] }) => {
    const dispatch = useDispatch();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => setPage(0), [searchResult]);
    const customers = useSelector(state => state.customers);
    const [openPopup, setOpenPopup] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<Confirmation>({
        isOpen: false,
        title: '',
        subTitle: '',
    });

    const CustomerNames = (id: string) => {
        const result = customers.find(customer => customer._id === id);
        return result ? result.name : '';
    };

    const handleRemove = (_id: string) => {
        setConfirmDialog({
            ...confirmDialog,
            isOpen: false,
        });
        dispatch(removeBill(_id));
    };

    const showBillDetails = (_id: string) => {
        dispatch(getBillById(_id));
        setOpenPopup(true);
    };

    return (
        <>
            <TableContainer className={ui("max-h-[440px]")} >
                <Table className={ui("w-full")} >
                    <TableHead>
                        <TableRow>
                            <TableCell>CUSTOMER NAME</TableCell>
                            <TableCell>INVOICE / DUE</TableCell>
                            <TableCell>TOTAL AMOUNT</TableCell>
                            <TableCell>STATUS / BALANCE</TableCell>
                            <TableCell>DETAILS</TableCell>
                            <TableCell>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {searchResult.slice(page * pageSize, (page + 1) * pageSize).map(bill => (
                                <TableRow key={bill._id} hover>
                                    <TableCell>{bill.customerSnapshot?.name || CustomerNames(bill.customer)}</TableCell>
                                    <TableCell>{bill.invoiceNumber || 'Legacy'}<br />{bill.dueDate || 'No due date'}</TableCell>
                                    <TableCell>{money(bill.total)}</TableCell>
                                    <TableCell><span className={ui('payment-badge status-' + paymentSummary(bill).status.toLowerCase().replace(' ', '-'))}>{paymentSummary(bill).status}</span><br />{money(paymentSummary(bill).balance)}</TableCell>
                                    <TableCell>
                                        <ActionButton aria-label={'View invoice ' + (bill.invoiceNumber || bill._id)} color='primary' onClick={() => showBillDetails(bill._id)}>
                                            <VisibilityTwoToneIcon />
                                        </ActionButton>
                                    </TableCell>
                                    <TableCell className='flex'>
                                        {!bill.invoiceNumber && !bill.payments?.length && !bill.cancellation && !bill.creditNote && <ActionButton
                                            aria-label={'Delete invoice ' + (bill.invoiceNumber || bill._id)}
                                            color='secondary'
                                            onClick={() => {
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Are you sure to delete this record?',
                                                    onConfirm: () => handleRemove(bill._id),
                                                });
                                            }}>
                                            <DeleteIcon />
                                        </ActionButton>}
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination component='div' count={searchResult.length} page={Math.min(page, Math.max(0, Math.ceil(searchResult.length / pageSize) - 1))} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]} onPageChange={(event, next) => setPage(next)} onRowsPerPageChange={event => { setPageSize(Number(event.target.value)); setPage(0); }} />
            <Popup title='Invoice details' size='document' openPopup={openPopup} setOpenPopup={setOpenPopup}>
                <ShowBills />
            </Popup>
            <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
        </>
    );
};

export default BillList;
