import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg, Loader } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

const blank = { label: 'Home', fullName: '', address: '', city: '', postalCode: '', country: '', isDefault: false };

function Profile() {
  const { user, setSession } = useAuth();
  const [f, setF] = useState({ name: user.name, email: user.email });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      setSession(await api('/account/profile', { method: 'PUT', token: user.token, body: f }));
      setMsg('Profile saved');
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="form" onSubmit={save}>
      <h3>Profile</h3>
      <ErrorMsg error={error} />
      {msg && <p role="status" className="ok">{msg}</p>}
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Email<input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <button className="btn">Save profile</button>
    </form>
  );
}

function Password() {
  const { user } = useAuth();
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      await api('/account/password', { method: 'PUT', token: user.token, body: f });
      setF({ current: '', next: '' });
      setMsg('Password updated');
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="form" onSubmit={save}>
      <h3>Change password</h3>
      <ErrorMsg error={error} />
      {msg && <p role="status" className="ok">{msg}</p>}
      <label>Current password<input required type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></label>
      <label>New password<input required type="password" minLength={6} autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></label>
      <button className="btn">Update password</button>
    </form>
  );
}

function Addresses() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/account/addresses', { token: user.token }).then(setList).catch((e) => setError(e.message)); }, []);

  const run = async (fn) => {
    setError('');
    try { setList(await fn()); setForm(null); } catch (err) { setError(err.message); }
  };
  const save = (e) => {
    e.preventDefault();
    const { _id, ...body } = form;
    run(() => api(_id ? `/account/addresses/${_id}` : '/account/addresses', { method: _id ? 'PUT' : 'POST', token: user.token, body }));
  };
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div>
      <div className="row between"><h3>Saved addresses</h3>{!form && <button className="btn small" onClick={() => setForm({ ...blank })}>+ Add address</button>}</div>
      <ErrorMsg error={error} />
      {form && (
        <form className="form" onSubmit={save}>
          <input required placeholder="Label (Home, Work…)" {...bind('label')} />
          <input required placeholder="Full name" autoComplete="name" {...bind('fullName')} />
          <input required placeholder="Address" autoComplete="street-address" {...bind('address')} />
          <div className="two">
            <input required placeholder="City" autoComplete="address-level2" {...bind('city')} />
            <input required placeholder="Postal code" autoComplete="postal-code" {...bind('postalCode')} />
          </div>
          <input required placeholder="Country" autoComplete="country-name" {...bind('country')} />
          <label className="check"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Make default</label>
          <div className="row gap"><button className="btn">{form._id ? 'Update' : 'Save address'}</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {!list ? <Loader /> : list.length === 0 && !form ? <p className="muted">No saved addresses yet.</p> : (
        <div className="addr-grid">
          {list.map((a) => (
            <div key={a._id} className="panel addr">
              <strong>{a.label}</strong> {a.isDefault && <span className="badge">Default</span>}
              <p>{a.fullName}<br />{a.address}<br />{a.city} {a.postalCode}, {a.country}</p>
              <div className="row gap">
                <button className="link" onClick={() => setForm({ ...a })}>Edit</button>
                {!a.isDefault && <button className="link" onClick={() => run(() => api(`/account/addresses/${a._id}`, { method: 'PUT', token: user.token, body: { isDefault: true } }))}>Make default</button>}
                <button className="link danger" onClick={() => confirm('Delete this address?') && run(() => api(`/account/addresses/${a._id}`, { method: 'DELETE', token: user.token }))}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Account() {
  useTitle('My account');
  const [tab, setTab] = useState('profile');
  const tabs = [['profile', 'Profile'], ['addresses', 'Addresses'], ['password', 'Password']];
  return (
    <>
      <h1>My account</h1>
      <div className="row tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={`link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="account-body">
        {tab === 'profile' && <Profile />}
        {tab === 'addresses' && <Addresses />}
        {tab === 'password' && <Password />}
      </div>
    </>
  );
}
