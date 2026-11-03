import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const isReg = mode === 'register';
  useTitle(isReg ? 'Create account' : 'Sign in');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isReg) await register(f.name, f.email, f.password);
      else await login(f.email, f.password);
      nav('/');
    } catch (err) {
      setError(err.message);
    }
  };
  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }), required: true });

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>{isReg ? 'Create account' : 'Sign in'}</h1>
      <ErrorMsg error={error} />
      {isReg && <input placeholder="Name" autoComplete="name" {...bind('name')} />}
      <input type="email" placeholder="Email" autoComplete="email" {...bind('email')} />
      <input type="password" placeholder="Password (min 6)" minLength={6} autoComplete={isReg ? 'new-password' : 'current-password'} {...bind('password')} />
      <button className="btn">{isReg ? 'Register' : 'Sign in'}</button>
      {!isReg && <small><Link to="/forgot-password">Forgot your password?</Link></small>}
      <small>
        {isReg ? <>Have an account? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create account</Link></>}
      </small>
    </form>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;

export function ForgotPassword() {
  useTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: { email } });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Forgot password</h1>
      <p className="muted">Enter your email and we will send a link to choose a new password.</p>
      <ErrorMsg error={error} />
      {done ? <p role="status">{done}</p> : (
        <>
          <input type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </>
      )}
      <small><Link to="/login">Back to sign in</Link></small>
    </form>
  );
}

export function ResetPassword() {
  useTitle('Reset password');
  const { token } = useParams();
  const { setSession } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSession(await api('/auth/reset', { method: 'POST', body: { token, password } }));
      nav('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Choose a new password</h1>
      <ErrorMsg error={error} />
      <input type="password" required minLength={6} placeholder="New password (min 6)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn">Update password</button>
      <small><Link to="/forgot-password">Request a new link</Link></small>
    </form>
  );
}
