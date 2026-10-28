import * as yup from 'yup';
import { useDispatch } from 'react-redux';
import { addCustomer, editCustomer } from '../../../Redux/Actions/customersAction';
import EntityEditor from '../../EntityEditor';
import { states, validGSTIN } from '../../../utils/indiaBilling';

const schema = yup.object({
    name: yup.string().trim().min(2, 'Use at least 2 characters').max(100).required('Customer name is required'),
    email: yup.string().trim().email('Enter a valid email').required('Email is required'),
    mobile: yup.string().matches(/^[0-9]{10,15}$/, 'Use 10–15 digits, without spaces').required('Phone number is required'),
    gstin: yup.string().trim().test('gstin', 'Enter a valid GSTIN', value => !value || validGSTIN(value.trim().toUpperCase()))
        .test('state', 'GSTIN must match the selected state', function(value) { return !value || value.slice(0, 2) === this.parent.state; }),
    address: yup.string().max(500), notes: yup.string().max(1000),
});
const sections = [
    { title: 'Identity & contact', description: 'The people and business behind the account.', fields: [
        { key: 'name', label: 'Customer / display name', required: true, maxLength: 100 },
        { key: 'company', label: 'Company / legal name', hint: 'Optional, for your internal records' },
        { key: 'contactPerson', label: 'Primary contact person' },
        { key: 'email', label: 'Billing email', type: 'email', required: true },
        { key: 'mobile', label: 'Phone number', type: 'tel', required: true, maxLength: 15, hint: '10–15 digits, without spaces' },
    ] },
    { title: 'Billing & tax defaults', description: 'Prefill new invoices and reduce repetitive entry.', fields: [
        { key: 'address', label: 'Billing / delivery address', multiline: true, wide: true, maxLength: 500 },
        { key: 'state', label: 'State / union territory', options: [['', 'Not specified'], ...Object.entries(states)] },
        { key: 'gstin', label: 'GSTIN (optional)', maxLength: 15, hint: 'Syntax checked, not verified with GSTN' },
    ] },
    { title: 'Relationship notes', description: 'Internal context. Not printed on invoices.', fields: [
        { key: 'notes', label: 'Internal notes', multiline: true, wide: true, maxLength: 1000, hint: 'Avoid passwords or sensitive payment credentials' },
    ] },
];
export default function CustomerForm({ editData, setOpenPopup }) {
    const dispatch = useDispatch();
    const initialValues = Object.fromEntries(['name', 'company', 'contactPerson', 'email', 'mobile', 'address', 'state', 'gstin', 'notes'].map(key => [key, editData?.[key] || '']));
    return <EntityEditor kind='customer' editing={Boolean(editData?._id)} initialValues={initialValues} validationSchema={schema} sections={sections} subtitle='Keep contact details, billing defaults and relationship context together.' onClose={setOpenPopup} onSave={values => dispatch(editData?._id ? editCustomer(values, editData._id) : addCustomer(values))} />;
}
