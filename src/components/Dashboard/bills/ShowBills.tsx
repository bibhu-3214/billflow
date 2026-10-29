import { useAppSelector as useSelector } from '../../../Redux/hooks';
import type { Invoice } from '../../../types/domain';
import React from 'react';

import InvoiceDocument from './InvoiceDocument';
export default function ShowBills() {
    const { billDetails } = useSelector(state => state.bills);
    return billDetails._id ? <InvoiceDocument key={billDetails._id} bill={billDetails as Invoice} /> : <p>Loading invoice…</p>;
}
