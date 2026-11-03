import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, money } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

export const ROLE_LABELS = { customer: 'Customer', support: 'Support', manager: 'Manager', admin: 'Admin' };
export const RoleBadge = ({ role }) => <span className={`badge role-${role}`}>{ROLE_LABELS[role] || role}</span>;

const blank = { name: '', email: '', password: '', role: 'customer' };

export default function Users() {
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null); // new-user form
  const [q, setQ] = useState(params.get('q') || '');
  const qs = params.toString();

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  const load = () => api(`/admin/users?${qs}`, { token: user.token }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [qs]);
  // Search as you type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => { if (q !== (params.get('q') || '')) set('q', q.trim()); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (fn, done) => {
    setError('');
    setNotice('');
    try { await fn(); if (done) setNotice(done); load(); } catch (err) { setError(err.message); }
  };
  const changeRole = (u, role) =>
    act(() => api(`/admin/users/${u._id}/role`, { method: 'PUT', token: user.token, body: { role } }));
  const suspend = (u) =>
    act(() => api(`/admin/users/${u._id}`, { method: 'PUT', token: user.token, body: { disabled: !u.disabled } }));
  const remove = (u) => {
    if (!confirm(`Delete ${u.email}? Their past orders are kept.`)) return;
    act(() => api(`/admin/users/${u._id}`, { method: 'DELETE', token: user.token }));
  };
  const create = (e) => {
    e.preventDefault();
    act(async () => {
      await api('/admin/users', { method: 'POST', token: user.token, body: form });
      setForm(null);
    }, 'User created.');
  };

  const manage = can('users.manage');
  const roles = can('roles');

  return (
    <>
      <div className="row between wrap gap">
        <h1>Users</h1>
        {manage && !form && <button className="btn" onClick={() => setForm({ ...blank })}>+ Add user</button>}
      </div>
      <ErrorMsg error={error} />
      {notice && <p className="ok">{notice}</p>}

      {form && (
        <form className="panel pform-inline" onSubmit={create}>
          <h3>New user</h3>
          <div className="two">
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Temporary password<input required minLength={6} type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <p className="muted">Share the password securely; they can change it from their account page, or you can send a reset link later.</p>
          <div className="row gap"><button className="btn">Create user</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      <div className="toolbar">
        <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select value={params.get('role') || ''} onChange={(e) => set('role', e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={params.get('status') || ''} onChange={(e) => set('status', e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {!data && !error ? <Loader /> : data && (
        <>
          <table className="table">
            <thead><tr><th>User</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.users.length === 0 && <tr><td colSpan="7" className="muted">No users match.</td></tr>}
              {data.users.map((u) => {
                const me = u._id === user._id;
                return (
                  <tr key={u._id}>
                    <td>
                      <Link to={`/admin/users/${u._id}`}><strong>{u.name}</strong></Link>{me && <small className="muted"> (you)</small>}
                      <br /><small className="muted">{u.email}</small>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>{u.orders}</td>
                    <td>{money(u.spent)}</td>
                    <td>
                      {roles && !me ? (
                        <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role for ${u.name}`}>
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : <RoleBadge role={u.role} />}
                    </td>
                    <td>{u.disabled ? <span className="badge out">Suspended</span> : <span className="badge Delivered">Active</span>}</td>
                    <td>
                      <div className="row gap">
                        <Link to={`/admin/users/${u._id}`}>View</Link>
                        {manage && !me && <button className="link" onClick={() => suspend(u)}>{u.disabled ? 'Reinstate' : 'Suspend'}</button>}
                        {manage && !me && <button className="link danger" onClick={() => remove(u)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">{data.total} user{data.total === 1 ? '' : 's'}</p>
          {data.pages > 1 && (
            <div className="row gap center pager">
              {Array.from({ length: data.pages }, (_, i) => (
                <button key={i} className={`btn small ${data.page === i + 1 ? '' : 'ghost'}`} onClick={() => set('page', String(i + 1))}>{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
