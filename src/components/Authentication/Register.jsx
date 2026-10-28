import React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import { useDispatch } from 'react-redux';
import { register } from '../../Redux/Actions/usersAction';
import { Link } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';

export default function Registration({ history }) {
    const dispatch = useDispatch();
    const formik = useFormik({
        initialValues: { username: '', email: '', password: '', businessName: '', address: '' },
        validationSchema: yup.object({
            username: yup.string().min(5, 'Use at least 5 characters').required('Name is required'),
            email: yup.string().email('Enter a valid email').required('Email is required'),
            password: yup
                .string()
                .min(12, 'Use at least 12 characters')
                .matches(/[a-z]/, 'Add a lowercase letter')
                .matches(/[A-Z]/, 'Add an uppercase letter')
                .matches(/[0-9]/, 'Add a number')
                .matches(/[^A-Za-z0-9]/, 'Add a symbol')
                .required('Password is required'),
            businessName: yup.string().required('Business name is required'),
            address: yup.string().required('Address is required'),
        }),
        onSubmit: values => dispatch(register(values, () => history.push('/login'))),
    });

    const fieldProps = name => ({
        id: 'register-' + name,
        name,
        value: formik.values[name],
        onChange: formik.handleChange,
        onBlur: formik.handleBlur,
        error: Boolean(formik.touched[name] && formik.errors[name]),
        helperText: formik.touched[name] && formik.errors[name],
    });

    return (
        <div className='auth-page page-enter'>
            <section className='auth-card surface-card'>
                <aside className='auth-aside'>
                    <div className='eyebrow'><span className='eyebrow-dot' /> Ready in minutes</div>
                    <h2>Bring order to every sale.</h2>
                    <p>Create a polished billing workspace for your business.</p>
                    <div className='auth-benefits'>
                        <div className='auth-benefit'><i /> Fast invoice generation</div>
                        <div className='auth-benefit'><i /> Organized product catalog</div>
                        <div className='auth-benefit'><i /> Clear performance trends</div>
                    </div>
                </aside>
                <div className='auth-form-panel'>
                    <h1>Create your workspace</h1>
                    <p>A few details and your billing hub is ready.</p>
                    <form className='auth-form' noValidate onSubmit={formik.handleSubmit}>
                        <TextField label='Your name' autoComplete='name' {...fieldProps('username')} />
                        <TextField label='Work email' type='email' autoComplete='email' {...fieldProps('email')} />
                        <TextField label='Password' type='password' autoComplete='new-password' {...fieldProps('password')} />
                        <p className='password-guidance'>12+ characters with upper and lowercase letters, a number, and a symbol.</p>
                        <TextField label='Business name' {...fieldProps('businessName')} />
                        <TextField label='Business address' multiline rows={2} {...fieldProps('address')} />
                        <Button color='primary' variant='contained' type='submit'>Create workspace</Button>
                    </form>
                    <div className='auth-foot'>Already have an account? <Link to='/login'>Sign in</Link></div>
                </div>
            </section>
        </div>
    );
}
