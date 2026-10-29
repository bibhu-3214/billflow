import { ui } from '../../../styles/ui';
import { useAppSelector as useSelector, useAppDispatch as useDispatch } from '../../../Redux/hooks';
import type { RouteComponentProps } from 'react-router-dom';
import type { Invoice } from '../../../types/domain';
import React, { useEffect } from 'react';

import { getBillById } from '../../../Redux/Actions/billAction';
import InvoiceDocument from './InvoiceDocument';
export default function ShowBillsById({ match }: RouteComponentProps<{id: string}>) {
    const dispatch = useDispatch();
    const { billDetails } = useSelector(state => state.bills);
    useEffect(() => { dispatch(getBillById(match.params.id)); }, [dispatch, match.params.id]);
    return <section className={ui("invoice-page page-enter")}><div className={ui("workspace-heading")}><div><h1>Invoice details</h1><p>Review your invoice, export a PDF and track payments.</p></div></div>
        {billDetails._id === match.params.id ? <InvoiceDocument key={billDetails._id} bill={billDetails as Invoice} /> : <p>Loading invoice…</p>}
    </section>;
}
