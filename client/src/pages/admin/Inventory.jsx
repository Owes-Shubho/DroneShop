import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, money, download } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg, DroneImage } from '../../components/Bits.jsx';
import useTitle from '../../useTitle.js';

const REASONS = {
  initial: 'Initial stock', purchase: 'Purchase', sale: 'Sale', cancellation: 'Order cancelled', refund: 'Refund',
  damaged: 'Damaged', correction: 'Correction', 'supplier-return': 'Returned to supplier', import: 'CSV import',
};
const MANUAL = [['purchase', 'Received from supplier'], ['damaged', 'Damaged / lost'], ['correction', 'Stock count correction'], ['supplier-return', 'Returned to supplier']];

const Pager = ({ data, onPage }) => data.pages > 1 && (
  <div className="row gap center pager">
    {Array.from({ length: data.pages }, (_, i) => (
      <button key={i} className={`btn small ${data.page === i + 1 ? '' : 'ghost'}`} onClick={() => onPage(String(i + 1))}>{i + 1}</button>
    ))}
  </div>
);

export default function Inventory() {
  useTitle('Inventory');
  const [params, setParams] = useSearchParams();
  const tab = ['stock', 'movements', 'suppliers'].includes(params.get('tab')) ? params.get('tab') : 'stock';
  return (
    <>
      <h1>Inventory</h1>
      <div className="tabs" role="tablist">
        {[['stock', 'Stock'], ['movements', 'Stock log'], ['suppliers', 'Suppliers']].map(([t, label]) => (
          <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'on' : ''} onClick={() => setParams(t === 'stock' ? {} : { tab: t })}>{label}</button>
        ))}
      </div>
      {tab === 'stock' && <StockTab />}
      {tab === 'movements' && <MovementsTab />}
      {tab === 'suppliers' && <SuppliersTab />}
    </>
  );
}

// ---------------- stock + adjust ----------------
function StockTab() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [adjusting, setAdjusting] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const qs = params.toString();

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const load = () => api(`/admin/inventory/stock?${qs}`, { token: user.token }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [qs]);
  useEffect(() => {
    api('/admin/inventory/suppliers', { token: user.token }).then((l) => setSuppliers(l.filter((s) => s.active))).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (q !== (params.get('q') || '')) set({ q: q.trim() }); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const start = (p) => setAdjusting({ product: p, reason: 'purchase', direction: 'add', quantity: '', note: '', supplier: '', unitCost: '' });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const f = adjusting;
    const qty = Number(f.quantity);
    const removes = f.reason === 'damaged' || f.reason === 'supplier-return' || (f.reason === 'correction' && f.direction === 'remove');
    try {
      const r = await api('/admin/inventory/adjust', {
        method: 'POST', token: user.token,
        body: { product: f.product._id, reason: f.reason, change: removes ? -qty : qty, note: f.note, supplier: f.supplier || undefined, unitCost: f.unitCost === '' ? undefined : Number(f.unitCost) },
      });
      setNotice(`${r.name}: ${r.change > 0 ? '+' : ''}${r.change}, now ${r.after} in stock.`);
      setAdjusting(null);
      load();
    } catch (err) { setError(err.message); }
  };
  const bind = (k) => ({ value: adjusting[k], onChange: (e) => setAdjusting({ ...adjusting, [k]: e.target.value }) });
  const needsSupplier = adjusting && (adjusting.reason === 'purchase' || adjusting.reason === 'supplier-return');

  return (
    <>
      <ErrorMsg error={error} />
      {notice && <p className="ok">{notice}</p>}
      {data && (
        <div className="kpis">
          <div className="kpi"><span>Products</span><strong>{data.summary.products}</strong></div>
          <div className="kpi"><span>Units in stock</span><strong>{data.summary.units.toLocaleString()}</strong></div>
          <div className="kpi"><span>Low (≤ {data.summary.lowThreshold})</span><strong>{data.summary.low}</strong></div>
          <div className="kpi"><span>Out of stock</span><strong>{data.summary.out}</strong></div>
        </div>
      )}

      {adjusting && (
        <form className="panel pform-inline" onSubmit={submit}>
          <h3>Adjust stock — {adjusting.product.name} <small className="muted">({adjusting.product.sku}, {adjusting.product.countInStock} in stock)</small></h3>
          <div className="two">
            <label>Reason
              <select {...bind('reason')}>{MANUAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            {adjusting.reason === 'correction' && (
              <label>Direction
                <select {...bind('direction')}><option value="add">Add to stock</option><option value="remove">Remove from stock</option></select>
              </label>
            )}
            <label>Quantity<input required type="number" min="1" step="1" {...bind('quantity')} /></label>
            {needsSupplier && (
              <label>Supplier
                <select {...bind('supplier')}><option value="">— none —</option>{suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
              </label>
            )}
            {adjusting.reason === 'purchase' && <label>Unit cost (USD)<input type="number" min="0" step="0.01" placeholder="optional" {...bind('unitCost')} /></label>}
          </div>
          <label>Note{['damaged', 'correction'].includes(adjusting.reason) ? ' (required)' : ''}
            <input maxLength={500} placeholder="PO number, what happened, who counted…" required={['damaged', 'correction'].includes(adjusting.reason)} {...bind('note')} />
          </label>
          <div className="row gap"><button className="btn">Save adjustment</button><button type="button" className="btn ghost" onClick={() => setAdjusting(null)}>Cancel</button></div>
        </form>
      )}

      <div className="toolbar">
        <input placeholder="Search name, SKU or brand" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stock" />
        <select value={params.get('filter') || ''} onChange={(e) => set({ filter: e.target.value })} aria-label="Stock level">
          <option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
      </div>

      {!data && !error ? <Loader /> : data && (
        <>
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>In stock</th><th /></tr></thead>
            <tbody>
              {data.products.length === 0 && <tr><td colSpan="6" className="muted">No products match.</td></tr>}
              {data.products.map((p) => (
                <tr key={p._id}>
                  <td><div className="row gap prod-cell"><div className="thumb"><DroneImage src={p.image} name={p.name} /></div><div><strong>{p.name}</strong><br /><small className="muted">{p.brand}</small></div></div></td>
                  <td><small>{p.sku || '—'}</small></td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.countInStock} {p.status !== 'OK' && <span className={`badge ${p.status === 'Low' ? 'Shipped' : 'out'}`}>{p.status === 'Low' ? 'Low' : 'Out'}</span>}</td>
                  <td>
                    <div className="row gap">
                      <button className="link" onClick={() => start(p)}>Adjust</button>
                      <Link to={`?tab=movements&product=${p._id}`}>History</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={data} onPage={(page) => set({ page })} />
        </>
      )}
    </>
  );
}

// ---------------- stock log ----------------
function MovementsTab() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const qs = params.toString();

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const apiQuery = () => {
    const p = new URLSearchParams(params);
    p.delete('tab');
    return p.toString();
  };
  useEffect(() => {
    setData(null);
    setError('');
    api(`/admin/inventory/movements?${apiQuery()}`, { token: user.token }).then(setData).catch((e) => setError(e.message));
  }, [qs]);
  useEffect(() => {
    const t = setTimeout(() => { if (q !== (params.get('q') || '')) set({ q: q.trim() }); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const exportCsv = () => download(`/admin/inventory/movements?${apiQuery()}&format=csv`, 'stock-movements.csv', user.token).catch((e) => setError(e.message));

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the stock log" />
        <select value={params.get('reason') || ''} onChange={(e) => set({ reason: e.target.value })} aria-label="Reason">
          <option value="">All reasons</option>
          {Object.entries(REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="inline">From <input type="date" value={params.get('from') || ''} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="inline">To <input type="date" value={params.get('to') || ''} onChange={(e) => set({ to: e.target.value })} /></label>
        <button className="btn ghost" onClick={exportCsv}>Export CSV</button>
      </div>
      {params.get('product') && <p className="muted">Showing one product. <button className="link" onClick={() => set({ product: '' })}>Show all</button></p>}
      <ErrorMsg error={error} />
      {!data && !error ? <Loader /> : data && (
        <>
          <table className="table">
            <thead><tr><th>When</th><th>Product</th><th>Change</th><th>Stock after</th><th>Reason</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {data.movements.length === 0 && <tr><td colSpan="7" className="muted">No stock movements match.</td></tr>}
              {data.movements.map((m) => (
                <tr key={m._id}>
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td><strong>{m.name}</strong><br /><small className="muted">{m.sku}</small></td>
                  <td><span className={`chg ${m.change > 0 ? 'plus' : 'minus'}`}>{m.change > 0 ? '+' : ''}{m.change}</span></td>
                  <td>{m.after}</td>
                  <td>{REASONS[m.reason] || m.reason}{m.supplier?.name && <><br /><small className="muted">{m.supplier.name}{m.unitCost !== undefined && ` · ${money(m.unitCost)} each`}</small></>}</td>
                  <td className="muted">{m.note || '—'}{m.order && <> <Link to={`/orders/${m.order}`}>order</Link></>}</td>
                  <td>{m.userName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">{data.total} movement{data.total === 1 ? '' : 's'}</p>
          <Pager data={data} onPage={(page) => set({ page })} />
        </>
      )}
    </>
  );
}

// ---------------- suppliers ----------------
const blankSupplier = { name: '', contactName: '', email: '', phone: '', address: '', notes: '', active: true };

function SuppliersTab() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/admin/inventory/suppliers', { token: user.token }).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const run = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(err.message); }
  };
  const save = (e) => {
    e.preventDefault();
    const { _id, name, contactName, email, phone, address, notes, active } = form;
    run(async () => {
      await api(_id ? `/admin/inventory/suppliers/${_id}` : '/admin/inventory/suppliers', { method: _id ? 'PUT' : 'POST', token: user.token, body: { name, contactName, email, phone, address, notes, active } });
      setForm(null);
    });
  };
  const toggle = (s) => run(() => api(`/admin/inventory/suppliers/${s._id}`, { method: 'PUT', token: user.token, body: { active: !s.active } }));
  const del = (s) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    run(() => api(`/admin/inventory/suppliers/${s._id}`, { method: 'DELETE', token: user.token }));
  };
  const bind = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="row between wrap gap">
        <p className="muted">Who you buy stock from. Pick a supplier when you record a purchase in the Stock tab.</p>
        {!form && <button className="btn" onClick={() => setForm({ ...blankSupplier })}>+ Add supplier</button>}
      </div>
      <ErrorMsg error={error} />
      {form && (
        <form className="panel pform-inline" onSubmit={save}>
          <h3>{form._id ? `Edit ${form.name}` : 'New supplier'}</h3>
          <div className="two">
            <label>Name<input required maxLength={80} {...bind('name')} /></label>
            <label>Contact person<input maxLength={80} {...bind('contactName')} /></label>
            <label>Email<input type="email" maxLength={120} {...bind('email')} /></label>
            <label>Phone<input maxLength={40} {...bind('phone')} /></label>
          </div>
          <label>Address<input maxLength={300} {...bind('address')} /></label>
          <label>Notes<textarea maxLength={500} {...bind('notes')} /></label>
          <div className="row gap"><button className="btn">{form._id ? 'Save changes' : 'Create supplier'}</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {!list && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Purchases</th><th>Last purchase</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list?.length === 0 && <tr><td colSpan="6" className="muted">No suppliers yet.</td></tr>}
            {list?.map((s) => (
              <tr key={s._id}>
                <td><strong>{s.name}</strong>{s.notes && <><br /><small className="muted">{s.notes}</small></>}</td>
                <td>{s.contactName || '—'}<br /><small className="muted">{[s.email, s.phone].filter(Boolean).join(' · ')}</small></td>
                <td>{s.purchases} · {s.unitsReceived} units</td>
                <td>{s.lastPurchase ? new Date(s.lastPurchase).toLocaleDateString() : '—'}</td>
                <td>{s.active ? <span className="badge Delivered">Active</span> : <span className="badge out">Inactive</span>}</td>
                <td>
                  <div className="row gap">
                    <button className="link" onClick={() => setForm({ ...blankSupplier, ...s })}>Edit</button>
                    <button className="link" onClick={() => toggle(s)}>{s.active ? 'Deactivate' : 'Activate'}</button>
                    <button className="link danger" onClick={() => del(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
