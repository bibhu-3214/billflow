import React from 'react';
import { Button, TextField, MenuItem, LinearProgress } from '@material-ui/core';
import { useFormik } from 'formik';
import { usePopupForm } from './Popup';

export default function EntityEditor({ initialValues, validationSchema, sections, onSave, onClose, kind, editing, subtitle }) {
    const formik = useFormik({ initialValues, validationSchema, onSubmit: async values => {
        formik.setStatus('');
        try {
            const result = await onSave(values);
            if (result?.ok) onClose(false);
            else formik.setStatus(result?.error || 'Could not save. Your entries are still here; please try again.');
        } catch (error) { formik.setStatus(error.message || 'Could not save this record.'); }
    } });
    const requestClose = usePopupForm(formik.dirty, formik.isSubmitting);
    const required = sections.flatMap(section => section.fields).filter(field => field.required);
    const complete = required.filter(field => String(formik.values[field.key] ?? '').trim()).length;
    return <form className='entity-editor' noValidate onSubmit={formik.handleSubmit}>
        <div className='editor-intro'><span className='editor-tag'>{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h3>{editing ? 'Fine-tune the details.' : 'Start with a complete profile.'}</h3><p>{subtitle}</p></div>
        <div className='editor-layout'><div className='editor-sections'>
            <fieldset disabled={formik.isSubmitting} className='studio-fields'>{sections.map((section, index) => <section className='editor-section' key={section.title}><header><span className='editor-step'>{String(index + 1).padStart(2, '0')}</span><div><h4>{section.title}</h4><p>{section.description}</p></div></header><div className='editor-field-grid'>{section.fields.map(field => <TextField key={field.key} id={kind + '-' + field.key} name={field.key} label={field.label} required={field.required} type={field.type || 'text'} select={Boolean(field.options)} multiline={field.multiline} rows={field.multiline ? 3 : undefined} className={field.wide ? 'editor-wide' : ''} fullWidth variant='outlined' value={formik.values[field.key]} onChange={formik.handleChange} onBlur={formik.handleBlur} inputProps={{ maxLength: field.maxLength || 120, ...field.inputProps }} error={Boolean(formik.touched[field.key] && formik.errors[field.key])} helperText={formik.touched[field.key] && formik.errors[field.key] ? formik.errors[field.key] : field.hint || ' '}>
                {field.options?.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>)}</div></section>)}</fieldset>
        </div><aside className='editor-preview'><span className='dialog-eyebrow'>LIVE PREVIEW</span><div className='editor-avatar'>{(formik.values.name || kind).charAt(0).toUpperCase()}</div><h4>{formik.values.name || (kind === 'customer' ? 'Customer name' : 'Item name')}</h4><p>{formik.values.company || formik.values.category || 'Details take shape as you type'}</p><dl>{kind === 'customer' ? <><dt>Contact</dt><dd>{formik.values.contactPerson || 'Not specified'}</dd><dt>Billing profile</dt><dd>{formik.values.gstin ? 'GSTIN entered · validation on save' : 'No GSTIN recorded'}</dd></> : <><dt>Base price</dt><dd>{formik.values.price ? 'INR ' + formik.values.price : 'Not set'} / {formik.values.unit || 'unit'}</dd><dt>Tax default</dt><dd>{formik.values.gstRate === '' ? 'Not set' : formik.values.gstRate + '%'}</dd></>}</dl><div className='editor-completeness'><span>{complete} / {required.length} required fields filled</span><LinearProgress variant='determinate' value={required.length ? complete / required.length * 100 : 100} /></div><p className='editor-note'>Saved in your encrypted browser workspace. Existing invoices keep their original details.</p></aside></div>
        {formik.status && <div className='editor-error' role='alert'>{formik.status}</div>}
        <footer className='editor-footer'><span aria-live='polite'>{formik.isSubmitting ? 'Saving securely…' : formik.dirty ? 'Unsaved changes' : 'Ready to edit'}</span><div><Button disabled={formik.isSubmitting} onClick={() => requestClose ? requestClose() : onClose(false)}>Cancel</Button><Button type='submit' variant='contained' color='primary' disabled={formik.isSubmitting}>{formik.isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create ' + kind}</Button></div></footer>
    </form>;
}
