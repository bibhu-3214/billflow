import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { getBillById } from '../../../Redux/Actions/billAction';
import InvoiceDocument from './InvoiceDocument';
export default function ShowBillsById({ match }) {
    const dispatch = useDispatch();
    const { billDetails } = useSelector(state => state.bills);
    useEffect(() => { dispatch(getBillById(match.params.id)); }, [dispatch, match.params.id]);
    return <section className='invoice-page page-enter'><div className='workspace-heading'><div><h1>Invoice details</h1><p>Review your invoice, export a PDF and track payments.</p></div></div>
        {billDetails._id === match.params.id ? <InvoiceDocument key={billDetails._id} bill={billDetails} /> : <p>Loading invoice…</p>}
    </section>;
}
