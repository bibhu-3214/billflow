import * as yup from 'yup';
import { useDispatch } from 'react-redux';
import { addProduct, editProduct } from '../../../Redux/Actions/productAction';
import EntityEditor from '../../EntityEditor';

const schema = yup.object({
    name: yup.string().trim().min(2, 'Use at least 2 characters').max(120).required('Item name is required'),
    price: yup.number().typeError('Enter a valid price').required('Price is required').positive('Price must be positive'),
    hsn: yup.string().matches(/^\d{4,8}$/, { message: 'Use 4–8 digits', excludeEmptyString: true }),
    gstRate: yup.number().transform((value, original) => original === '' ? undefined : value).typeError('Enter a number').min(0).max(40),
    unit: yup.string().trim().required('Unit is required').max(12), description: yup.string().max(1000),
});
const sections = [
    { title: 'Catalog identity', description: 'Make the right item easy to find.', fields: [
        { key: 'name', label: 'Product / service name', required: true, wide: true },
        { key: 'sku', label: 'SKU / item code', maxLength: 60, hint: 'Optional internal reference' },
        { key: 'category', label: 'Category', maxLength: 80, hint: 'For example, services or supplies' },
        { key: 'description', label: 'Internal description', multiline: true, wide: true, maxLength: 1000, hint: 'Catalog reference only; not printed on invoices' },
    ] },
    { title: 'Pricing & tax defaults', description: 'Tax-exclusive pricing, ready for your next invoice.', fields: [
        { key: 'price', label: 'Base price (INR)', type: 'number', required: true, inputProps: { min: 0.01, step: 0.01 } },
        { key: 'unit', label: 'Unit', required: true, maxLength: 12, hint: 'NOS, HRS, KG or your preferred unit' },
        { key: 'hsn', label: 'HSN / SAC', maxLength: 8, hint: 'Optional; use 4–8 digits' },
        { key: 'gstRate', label: 'Default GST (%)', type: 'number', inputProps: { min: 0, max: 40, step: 0.01 }, hint: 'Confirm the applicable classification and rate' },
    ] },
];
export default function ProductForm({ editData, setOpenPopup }) {
    const dispatch = useDispatch();
    const initialValues = { name: editData?.name || '', price: editData?.price ?? '', sku: editData?.sku || '', category: editData?.category || '', description: editData?.description || '', hsn: editData?.hsn || '', gstRate: editData?.gstRate ?? '', unit: editData?.unit || 'NOS' };
    return <EntityEditor kind='item' editing={Boolean(editData?._id)} initialValues={initialValues} validationSchema={schema} sections={sections} subtitle='Build a reusable catalog with clear pricing and dependable invoice defaults.' onClose={setOpenPopup} onSave={values => dispatch(editData?._id ? editProduct(values, editData._id) : addProduct(values))} />;
}
