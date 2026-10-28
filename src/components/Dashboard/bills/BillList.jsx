import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import DeleteIcon from '@material-ui/icons/DeleteOutlineRounded';
import TableContainer from '@material-ui/core/TableContainer';
import ConfirmDialog from './ConfirmDialog';
import ActionButton from '../../controls/ActionButton';
import { getBillById, removeBill } from '../../../Redux/Actions/billAction';
import { TablePagination } from '@material-ui/core';
import VisibilityTwoToneIcon from '@material-ui/icons/VisibilityTwoTone';
import Popup from '../../Popup';
import ShowBills from './ShowBills';
import { money, paymentSummary } from '../../../utils/indiaBilling';

const useStyles1 = makeStyles(theme => ({
    table: {
        width: '100%',
        marginTop: theme.spacing(3),
        '& thead th': {
            fontWeight: '600',
            color: '#65708a',
            backgroundColor: '#f7f8fc',
        },
        '& tbody td': {
            fontWeight: '500',
        },
        '& tbody tr:hover': {
            backgroundColor: '#f8f9ff',
            cursor: 'pointer',
        },
    },
}));

const useStyles = makeStyles({
    container: {
        width: '100%',
        maxHeight: 440,
    },
});

const BillList = ({ searchResult }) => {
    const classes = useStyles();
    const classes1 = useStyles1();
    const dispatch = useDispatch();
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => setPage(0), [searchResult]);
    const customers = useSelector(state => state.customers);
    const [openPopup, setOpenPopup] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        subTitle: '',
    });

    const CustomerNames = id => {
        const result = customers.find(customer => customer._id === id);
        return result ? result.name : '';
    };

    const handleRemove = _id => {
        setConfirmDialog({
            ...confirmDialog,
            isOpen: false,
        });
        dispatch(removeBill(_id));
    };

    const showBillDetails = _id => {
        dispatch(getBillById(_id));
        setOpenPopup(true);
    };

    return (
        <>
            <TableContainer className={classes.container}>
                <Table className={classes1.table}>
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
                                    <TableCell><span className={'payment-badge status-' + paymentSummary(bill).status.toLowerCase().replace(' ', '-')}>{paymentSummary(bill).status}</span><br />{money(paymentSummary(bill).balance)}</TableCell>
                                    <TableCell>
                                        <ActionButton aria-label={'View invoice ' + (bill.invoiceNumber || bill._id)} color='primary' onClick={() => showBillDetails(bill._id)}>
                                            <VisibilityTwoToneIcon />
                                        </ActionButton>
                                    </TableCell>
                                    <TableCell style={{ display: 'flex' }}>
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
