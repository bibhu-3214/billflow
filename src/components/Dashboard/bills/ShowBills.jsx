import React from 'react';
import { useSelector } from 'react-redux';
import InvoiceDocument from './InvoiceDocument';
export default function ShowBills() {
    const { billDetails } = useSelector(state => state.bills);
    return billDetails._id ? <InvoiceDocument key={billDetails._id} bill={billDetails} /> : <p>Loading invoice…</p>;
}
