import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

const blank = { code: '', type: 'percent', value: '', minSubtotal: '', usageLimit: '', expiresAt: '', active: true };
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const describe = (c) => (c.type === 'percent' ? `${c.value}% off` : `${money(c.value)} off`);
const state = (c) => {
  if (!c.active) return ['Off', 'out'];
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return ['Expired', 'out'];
  if (c.usageLimit && c.usedCount >= c.usageLimit) return ['Used up', 'out'];
  return ['Active', 'Delivered'];
};

export default function Coupons() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/admin/coupons', { token: user.token }).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const { _id, usedCount, createdAt, updatedAt, __v, ...rest } = form;
    const body = {
      ...rest,
      value: Number(rest.value),
      minSubtotal: rest.minSubtotal === '' ? 0 : Number(rest.minSubtotal),
      usageLimit: rest.usageLimit === '' ? '' : Number(rest.usageLimit),
      // End of the chosen day, so "expires on the 30th" includes the 30th.
      expiresAt: rest.expiresAt ? new Date(`${rest.expiresAt}T23:59:59`).toISOString() : '',
    };
    try {
      await api(_id ? `/admin/coupons/${_id}` : '/admin/coupons', { method: _id ? 'PUT' : 'POST', token: user.token, body });
      setForm(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const toggle = async (c) => {
    try { await api(`/admin/coupons/${c._id}`, { method: 'PUT', token: user.token, body: { active: !c.active } }); load(); }
    catch (err) { setError(err.message); }
  };
  const del = async (c) => {
    if (!confirm(`Delete coupon ${c.code}? Past orders keep their discount.`)) return;
    try { await api(`/admin/coupons/${c._id}`, { method: 'DELETE', token: user.token }); load(); }
    catch (err) { setError(err.message); }
  };

  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="row between wrap gap">
        <h1>Coupons</h1>
        {!form && <button className="btn" onClick={() => setForm({ ...blank })}>+ New coupon</button>}
      </div>
      <ErrorMsg error={error} />

      {form && (
        <form className="panel pform-inline" onSubmit={save}>
          <h3>{form._id ? `Edit ${form.code}` : 'New coupon'}</h3>
          <div className="two">
            <label>Code<input required pattern="[A-Za-z0-9_\-]{3,20}" title="3–20 letters, numbers, - or _" placeholder="SUMMER25" {...bind('code')} /></label>
            <label>Type
              <select {...bind('type')}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></select>
            </label>
            <label>{form.type === 'percent' ? 'Percent (1–100)' : 'Amount (USD)'}
              <input required type="number" min="0.01" max={form.type === 'percent' ? 100 : undefined} step="0.01" {...bind('value')} />
            </label>
            <label>Minimum order (USD)<input type="number" min="0" step="0.01" placeholder="none" {...bind('minSubtotal')} /></label>
            <label>Usage limit<input type="number" min="1" step="1" placeholder="unlimited" {...bind('usageLimit')} /></label>
            <label>Expires on<input type="date" {...bind('expiresAt')} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <div className="row gap"><button className="btn">{form._id ? 'Save changes' : 'Create coupon'}</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {!list && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list?.length === 0 && <tr><td colSpan="7" className="muted">No coupons yet.</td></tr>}
            {list?.map((c) => {
              const [label, cls] = state(c);
              return (
                <tr key={c._id}>
                  <td><strong>{c.code}</strong></td>
                  <td>{describe(c)}</td>
                  <td>{c.minSubtotal ? money(c.minSubtotal) : '—'}</td>
                  <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  <td>
                    <div className="row gap">
                      <button className="link" onClick={() => setForm({ ...c, minSubtotal: c.minSubtotal || '', usageLimit: c.usageLimit || '', expiresAt: dateInput(c.expiresAt) })}>Edit</button>
                      <button className="link" onClick={() => toggle(c)}>{c.active ? 'Turn off' : 'Turn on'}</button>
                      <button className="link danger" onClick={() => del(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
