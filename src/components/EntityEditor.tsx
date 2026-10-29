import { ui } from '../styles/ui';
import { Button, TextField, MenuItem, LinearProgress } from './ui/primitives';
import type { InputHTMLAttributes } from 'react';
import type { SaveResult } from '../Redux/types';
export interface EditorField { key: string; label: string; required?: boolean; type?: string; multiline?: boolean; wide?: boolean; maxLength?: number; hint?: string; inputProps?: InputHTMLAttributes<HTMLInputElement>; options?: [string, string][] }
export interface EditorSection { title: string; description: string; fields: EditorField[] }
interface EditorProps<T extends Record<string, string | number>> { initialValues: T; validationSchema: object; sections: EditorSection[]; onSave: (values: T) => Promise<SaveResult | undefined>; onClose: (open: boolean) => void; kind: 'customer' | 'item'; editing: boolean; subtitle: string }
import { asAppError } from '../types/domain';
import React from 'react';

import { useFormik } from 'formik';
import { usePopupForm } from './Popup';

export default function EntityEditor<T extends Record<string, string | number>>({ initialValues, validationSchema, sections, onSave, onClose, kind, editing, subtitle }: EditorProps<T>) {
    const formik = useFormik<T>({ initialValues, validationSchema, onSubmit: async values => {
        formik.setStatus('');
        try {
            const result = await onSave(values);
            if (result?.ok) onClose(false);
            else formik.setStatus(result?.error || 'Could not save. Your entries are still here; please try again.');
        } catch (caughtError) { const error = asAppError(caughtError);  formik.setStatus(error.message || 'Could not save this record.'); }
    } });
    const status: unknown = formik.status;
    const requestClose = usePopupForm(formik.dirty, formik.isSubmitting);
    const required = sections.flatMap(section => section.fields).filter(field => field.required);
    const complete = required.filter(field => String(formik.values[field.key] ?? '').trim()).length;
    return <form className={ui("entity-editor")} noValidate onSubmit={formik.handleSubmit}>
        <div className={ui("editor-intro")}><span className={ui("editor-tag")}>{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h3>{editing ? 'Fine-tune the details.' : 'Start with a complete profile.'}</h3><p>{subtitle}</p></div>
        <div className={ui("editor-layout")}><div className={ui("editor-sections")}>
            <fieldset disabled={formik.isSubmitting} className={ui("studio-fields")}>{sections.map((section, index) => <section className={ui("editor-section")} key={section.title}><header><span className={ui("editor-step")}>{String(index + 1).padStart(2, '0')}</span><div><h4>{section.title}</h4><p>{section.description}</p></div></header><div className={ui("editor-field-grid")}>{section.fields.map(field => <TextField key={field.key} id={kind + '-' + field.key} name={field.key} label={field.label} required={field.required} type={field.type || 'text'} select={Boolean(field.options)} multiline={field.multiline} rows={field.multiline ? 3 : undefined} className={ui(field.wide ? 'editor-wide' : '')} fullWidth variant='outlined' value={formik.values[field.key]} onChange={formik.handleChange} onBlur={formik.handleBlur} inputProps={{ maxLength: field.maxLength || 120, ...field.inputProps }} error={Boolean(formik.touched[field.key] && formik.errors[field.key])} helperText={formik.touched[field.key] && typeof formik.errors[field.key] === 'string' ? String(formik.errors[field.key]) : field.hint || ' '}>
                {field.options?.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>)}</div></section>)}</fieldset>
        </div><aside className={ui("editor-preview")}><span className={ui("dialog-eyebrow")}>LIVE PREVIEW</span><div className={ui("editor-avatar")}>{String(formik.values.name || kind).charAt(0).toUpperCase()}</div><h4>{formik.values.name || (kind === 'customer' ? 'Customer name' : 'Item name')}</h4><p>{formik.values.company || formik.values.category || 'Details take shape as you type'}</p><dl>{kind === 'customer' ? <><dt>Contact</dt><dd>{formik.values.contactPerson || 'Not specified'}</dd><dt>Billing profile</dt><dd>{formik.values.gstin ? 'GSTIN entered · validation on save' : 'No GSTIN recorded'}</dd></> : <><dt>Base price</dt><dd>{formik.values.price ? 'INR ' + formik.values.price : 'Not set'} / {formik.values.unit || 'unit'}</dd><dt>Tax default</dt><dd>{formik.values.gstRate === '' ? 'Not set' : formik.values.gstRate + '%'}</dd></>}</dl><div className={ui("editor-completeness")}><span>{complete} / {required.length} required fields filled</span><LinearProgress variant='determinate' value={required.length ? complete / required.length * 100 : 100} /></div><p className={ui("editor-note")}>Saved in your encrypted browser workspace. Existing invoices keep their original details.</p></aside></div>
        {typeof status === 'string' && status && <div className={ui("editor-error")} role='alert'>{status}</div>}
        <footer className={ui("editor-footer")}><span aria-live='polite'>{formik.isSubmitting ? 'Saving securely…' : formik.dirty ? 'Unsaved changes' : 'Ready to edit'}</span><div><Button disabled={formik.isSubmitting} onClick={() => requestClose ? requestClose() : onClose(false)}>Cancel</Button><Button type='submit' variant='contained' color='primary' disabled={formik.isSubmitting}>{formik.isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create ' + kind}</Button></div></footer>
    </form>;
}
