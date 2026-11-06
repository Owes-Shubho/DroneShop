import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money, statusClass } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';
import { RoleBadge, ROLE_LABELS } from './Users.jsx';

export default function UserDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api(`/admin/users/${id}`, { token: user.token })
    .then((d) => { setU(d); setForm({ name: d.name, email: d.email }); })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const act = async (fn, done) => {
    setError('');
    setNotice('');
    try { await fn(); if (done) setNotice(done); await load(); } catch (err) { setError(err.message); }
  };
  const call = (path, method, body) => api(`/admin/users/${id}${path}`, { method, token: user.token, body });

  if (!u) return error ? <ErrorMsg error={error} /> : <Loader />;
  const me = u._id === user._id;
  const manage = can('users.manage');
  const roles = can('roles');

  return (
    <>
      <p><Link to="/admin/users">← Users</Link></p>
      <div className="row between wrap gap">
        <h1>{u.name}{me && <small className="muted"> (you)</small>}</h1>
        <div className="row gap"><RoleBadge role={u.role} />{u.disabled && <span className="badge out">Suspended</span>}</div>
      </div>
      <ErrorMsg error={error} />
      {notice && <p className="ok">{notice}</p>}

      <div className="stat-row">
        <div className="stat"><span>Orders</span><strong>{u.orders}</strong></div>
        <div className="stat"><span>Spent</span><strong>{money(u.spent)}</strong></div>
        <div className="stat"><span>Wishlist</span><strong>{u.wishlistCount}</strong></div>
        <div className="stat"><span>Joined</span><strong>{new Date(u.createdAt).toLocaleDateString()}</strong></div>
        <div className="stat"><span>Last sign-in</span><strong>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</strong></div>
      </div>

      <div className="pform">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); act(() => call('', 'PUT', form), 'Saved.'); }}>
          <h3>Profile</h3>
          <label>Name<input required value={form.name} disabled={!manage} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} disabled={!manage} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          {manage && <button className="btn">Save changes</button>}
          {u.addresses?.length > 0 && (
            <>
              <h3>Addresses</h3>
              {u.addresses.map((a) => (
                <p key={a._id}><strong>{a.label}</strong>{a.isDefault && ' (default)'}<br />{a.fullName}, {a.address}, {a.city} {a.postalCode}, {a.country}</p>
              ))}
            </>
          )}
        </form>

        <div className="panel">
          <h3>Role and access</h3>
          {roles && !me ? (
            <label>Role
              <select value={u.role} onChange={(e) => act(() => call('/role', 'PUT', { role: e.target.value }), 'Role updated.')}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ) : <p>Role: <RoleBadge role={u.role} />{me && <small className="muted"> You cannot change your own role.</small>}</p>}
          <p className="muted"><Link to="/admin/roles">See what each role can do</Link></p>

          {manage && !me && (
            <div className="stack">
              <button className="btn ghost" onClick={() => act(() => call('', 'PUT', { disabled: !u.disabled }), u.disabled ? 'Account reinstated.' : 'Account suspended.')}>
                {u.disabled ? 'Reinstate account' : 'Suspend account'}
              </button>
              <button className="btn ghost" onClick={() => { if (confirm(`Email a password reset link to ${u.email}?`)) act(async () => { const r = await call('/reset-password', 'POST'); setNotice(r.message); }); }}>
                Send password reset link
              </button>
              <button className="btn ghost danger-btn" onClick={() => {
                if (confirm(`Delete ${u.email}? Their past orders are kept.`)) act(async () => { await call('', 'DELETE'); nav('/admin/users'); });
              }}>Delete user</button>
            </div>
          )}
          {u.disabled && <p className="muted">Suspended accounts cannot sign in, and any session they have open stops working.</p>}
        </div>
      </div>

      <h2>Recent orders</h2>
      {u.recentOrders.length === 0 ? <p className="muted">No orders yet.</p> : (
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {u.recentOrders.map((o) => (
              <tr key={o._id}>
                <td><Link to={`/orders/${o._id}`}>{o._id.slice(-8)}</Link></td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td>{money(o.totalPrice)}</td>
                <td><span className={`badge ${statusClass(o.status)}`}>{o.status}</span>{o.isRefunded && ' refunded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
