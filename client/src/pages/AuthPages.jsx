import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg } from '../components/Bits.jsx';

function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const isReg = mode === 'register';
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
      {isReg && <input placeholder="Name" {...bind('name')} />}
      <input type="email" placeholder="Email" {...bind('email')} />
      <input type="password" placeholder="Password (min 6)" minLength={6} {...bind('password')} />
      <button className="btn">{isReg ? 'Register' : 'Sign in'}</button>
      <small>
        {isReg ? <>Have an account? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create account</Link></>}
      </small>
    </form>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
