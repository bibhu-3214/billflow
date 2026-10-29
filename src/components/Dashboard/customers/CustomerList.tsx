import { ui } from '../../../styles/ui';
import { Pencil as EditTwoToneIcon, Trash2 as DeleteIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '../../ui/primitives';
import { useAppDispatch as useDispatch } from '../../../Redux/hooks';
import type { Customer } from '../../../types/domain';
import type { Confirmation } from '../../ConfirmAction';
import type { customerAccounts } from '../../../utils/receivables';
type CustomerAccountRow = ReturnType<typeof customerAccounts>[number];
import React, { useState } from 'react';

import { removeCustomer } from '../../../Redux/Actions/customersAction';

import ConfirmDialog from './ConfirmDialog';
import Popup from '../../Popup';
import ActionButton from '../../controls/ActionButton';
import CustomerForm from './CustomerForm';
import CustomerAccount from './CustomerAccount';
import { money } from '../../../utils/indiaBilling';

const CustomerList = ({ searchResult }: { searchResult: CustomerAccountRow[] }) => {
    const dispatch = useDispatch();
    const [account, setAccount] = useState<Customer | null>(null);
    const [openPopup, setOpenPopup] = useState(false);
    const [editData, setEditData] = useState<Customer | null>(null);
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
        dispatch(removeCustomer(_id));
    };

    const handleEdit = (data: Customer) => {
        setEditData(data);
        handleToggle();
    };

    return (
        <>
            <TableContainer className={ui("max-h-[440px]")} >
                <Table className={ui("w-full")} >
                    <TableHead>
                        <TableRow>
                            <TableCell>CUSTOMER NAME</TableCell>
                            <TableCell>EMAIL</TableCell>
                            <TableCell>CONTACT</TableCell>
                            <TableCell>ACCOUNT BALANCE</TableCell>
                            <TableCell align='right'>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {searchResult.map(customer => (
                            <TableRow key={customer._id} hover>
                                <TableCell>
                                    <div className={ui("entity-cell")}>
                                        <span className={ui("entity-avatar")}>{customer.name.charAt(0).toUpperCase()}</span>
                                        <div><button className={ui("text-action")} onClick={() => setAccount(customer)}>{customer.name}</button><span>{customer.invoiceCount || 0} invoices · {customer.lastInvoice || 'No billing history'}</span></div>
                                    </div>
                                </TableCell>
                                <TableCell><span className={ui("contact-value")}>{customer.email}</span></TableCell>
                                <TableCell><span className={ui("contact-value")}>{customer.mobile}</span></TableCell>
                                <TableCell><strong>{money(customer.outstanding || 0)}</strong><br /><span className={ui(customer.overdue > 0 ? 'queue-age danger' : 'queue-age')}>{customer.overdue > 0 ? money(customer.overdue) + ' overdue' : 'No overdue balance'}</span></TableCell>
                                <TableCell align='right'>
                                    <div className={ui("table-actions")}>
                                    <ActionButton
                                        aria-label={`Edit ${customer.name}`}
                                        color='primary'
                                        onClick={() => handleEdit(customer)}>
                                        <EditTwoToneIcon />
                                    </ActionButton>
                                    <ActionButton
                                        aria-label={`Delete ${customer.name}`}
                                        color='secondary'
                                        onClick={() => {
                                            setConfirmDialog({
                                                isOpen: true,
                                                title: 'Are you sure to delete this record?',
                                                subTitle: 'Customers linked to invoices are protected from deletion. Otherwise, this permanently removes the profile.',
                                                onConfirm: () => {
                                                    handleRemove(customer._id);
                                                },
                                            });
                                        }}>
                                        <DeleteIcon />
                                    </ActionButton>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Popup title='Customer account' size='document' openPopup={Boolean(account)} setOpenPopup={() => setAccount(null)}>{account && <CustomerAccount customer={account} />}</Popup>
            {editData && toggle ? (
                <Popup title='Customer studio' size='editor' openPopup={openPopup} setOpenPopup={setOpenPopup}>
                    <CustomerForm editData={editData} handleToggle={handleToggle} setOpenPopup={setOpenPopup} />
                </Popup>
            ) : null}
            <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
        </>
    );
};

export default CustomerList;
