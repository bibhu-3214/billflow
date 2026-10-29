import { ui } from '../../styles/ui';
import { TextField, Button } from '../ui/primitives';
import type { RouteComponentProps } from 'react-router-dom';
import { useAppDispatch as useDispatch } from '../../Redux/hooks';
import React from 'react';

import { login } from '../../Redux/Actions/usersAction';
import { Link } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import RestoreBackup from './RestoreBackup';
import localData from '../../data/localData';
import SocialSignIn from './SocialSignIn';

export default function Login({ history }: Pick<RouteComponentProps, 'history'>) {
    const dispatch = useDispatch();
    const configured: unknown = localData.isCloud ? JSON.parse(process.env.REACT_APP_LOCAL_LOGIN || '{}') : {};
    const localLogin = configured && typeof configured === 'object' ? configured as Record<string, unknown> : {};
    const formik = useFormik({
        initialValues: { email: typeof localLogin.email === 'string' ? localLogin.email : '', password: typeof localLogin.password === 'string' ? localLogin.password : '' },
        validationSchema: yup.object({
            email: yup.string().email('Enter a valid email').required('Email is required'),
            password: yup.string().required('Password is required'),
        }),
        onSubmit: values => dispatch(login(values, () => history.push('/admin'))),
    });

    const fieldProps = (name: keyof typeof formik.values) => ({
        id: 'login-' + name,
        name,
        value: formik.values[name],
        onChange: formik.handleChange,
        onBlur: formik.handleBlur,
        error: Boolean(formik.touched[name] && formik.errors[name]),
        helperText: formik.touched[name] && formik.errors[name],
    });

    return (
        <div className={ui("auth-page page-enter")}>
            <section className={ui("auth-card surface-card")}>
                <aside className={ui("auth-aside")}>
                    <div className={ui("eyebrow")}><span className={ui("eyebrow-dot")} /> {localData.isCloud ? 'Your business workspace' : 'Local workspace'}</div>
                    <h2>Welcome back to better billing.</h2>
                    <p>Pick up exactly where your business left off.</p>
                    <div className={ui("auth-benefits")}>
                        <div className={ui("auth-benefit")}><i /> One view for every invoice</div>
                        <div className={ui("auth-benefit")}><i /> Live revenue visibility</div>
                        <div className={ui("auth-benefit")}><i /> {localData.isCloud ? 'One account across your devices' : 'Data stays on this device'}</div>
                    </div>
                </aside>
                <div className={ui("auth-form-panel")}>
                    <h1>Sign in</h1>
                    <p>{localLogin.email ? 'Your local test account is ready to use.' : 'Enter your account details to open your workspace.'}</p>
                    <form className={ui("auth-form")} noValidate onSubmit={formik.handleSubmit}>
                        <TextField label='Work email' type='email' autoComplete='email' {...fieldProps('email')} />
                        <TextField label='Password' type='password' autoComplete='current-password' {...fieldProps('password')} />
                        <Button color='primary' variant='contained' type='submit'>Open workspace</Button>
                    </form>
                    <div className={ui("auth-foot")}>New to BillFlow? <Link to='/register'>Create an account</Link></div>
                    {localData.isCloud ? <><SocialSignIn /><div className={ui("auth-foot")}><Link to='/account?reset=1'>Forgot password?</Link> · <Link to='/account'>Verify email</Link></div><p>Import an existing backup after signing in, under Business settings.</p></> : <RestoreBackup />}
                </div>
            </section>
        </div>
    );
}
