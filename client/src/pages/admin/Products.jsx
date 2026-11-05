import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, money, download } from '../../api.js';
import useCategories from '../../useCategories.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DroneImage, Loader, ErrorMsg } from '../../components/Bits.jsx';

async function loadAll() {
  const first = await api('/products?limit=50&sort=newest');
  const rest = await Promise.all(
    Array.from({ length: first.pages - 1 }, (_, i) => api(`/products?limit=50&sort=newest&page=${i + 2}`))
  );
  return [first, ...rest].flatMap((r) => r.products);
}

export default function Products() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [importResult, setImportResult] = useState(null);
  const categories = useCategories().map((c) => c.name);
  const category = params.get('category') || '';
  const stock = params.get('stock') || '';
  const brand = params.get('brand') || '';

  const load = () => loadAll().then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next);
  };

  const rows = useMemo(() => (list || []).filter((p) =>
    (!category || p.category === category) &&
    (!brand || p.brand === brand) &&
    (!stock || (stock === 'low' ? p.countInStock <= 5 : stock === 'out' ? p.countInStock === 0 : true)) &&
    (!q || `${p.name} ${p.brand} ${p.sku || ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [list, q, category, brand, stock]);

  const updateStock = async (p, value) => {
    const n = Math.max(0, Math.floor(Number(value)));
    if (Number.isNaN(n) || n === p.countInStock) return;
    setError('');
    try {
      const saved = await api(`/products/${p._id}`, { method: 'PUT', token: user.token, body: { countInStock: n } });
      setList((l) => l.map((x) => (x._id === p._id ? { ...x, countInStock: saved.countInStock } : x)));
    } catch (err) { setError(err.message); }
  };

  const importCsv = async (file) => {
    if (!file) return;
    setError('');
    setImportResult(null);
    try {
      const result = await api('/admin/import/products', { method: 'POST', token: user.token, body: { csv: await file.text() } });
      setImportResult(result);
      load();
    } catch (err) { setError(err.message); }
  };

  const del = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setError('');
    try {
      await api(`/products/${p._id}`, { method: 'DELETE', token: user.token });
      setList((l) => l.filter((x) => x._id !== p._id));
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="row between wrap gap">
        <h1>Products</h1>
        <div className="row gap">
          <label className="btn ghost file-btn">Import CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { importCsv(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <button className="btn ghost" onClick={() => download('/admin/export/products.csv', 'products.csv', user.token).catch((e) => setError(e.message))}>Export CSV</button>
          <Link to="/admin/products/new" className="btn">+ Add product</Link>
        </div>
      </div>

      <div className="toolbar">
        <input placeholder="Search name, brand or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={stock} onChange={(e) => setParam('stock', e.target.value)}>
          <option value="">Any stock</option>
          <option value="low">Low stock (≤ 5)</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      <ErrorMsg error={error} />
      {importResult && (
        <div className="panel">
          <strong>Import finished:</strong> {importResult.created} added, {importResult.updated} updated, {importResult.errors.length} skipped.
          {importResult.errors.length > 0 && (
            <ul>{importResult.errors.slice(0, 20).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul>
          )}
        </div>
      )}
      <p className="muted">CSV import columns: name, brand, category, price, stock, description. Optional: sku, cost, model, mpn, condition, warranty (months), image, and spec: columns such as "spec:Motor KV". Rows are matched by SKU (or by name and brand when there is no SKU) and update that product; new brands are created.</p>
      {!list && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="6" className="muted">No products match.</td></tr>}
            {rows.map((p) => (
              <tr key={p._id}>
                <td>
                  <div className="row gap prod-cell">
                    <div className="thumb"><DroneImage src={p.image} name={p.name} /></div>
                    <div><strong>{p.name}</strong><br /><small className="muted">{p.brand}</small></div>
                  </div>
                </td>
                <td><small>{p.sku || '—'}</small></td>
                <td>{p.category}</td>
                <td>{money(p.price)}</td>
                <td>
                  <input className="stock-input" type="number" min="0" defaultValue={p.countInStock} key={p.countInStock}
                    aria-label={`Stock for ${p.name}`} onBlur={(e) => updateStock(p, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                  {p.countInStock === 0 && <span className="badge out">Out</span>}
                </td>
                <td>
                  <div className="row gap">
                    <Link to={`/admin/products/${p._id}`}>Edit</Link>
                    <button className="link danger" onClick={() => del(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list && <p className="muted">{rows.length} of {list.length} products. Edit stock in place — it saves when you leave the field.</p>}
    </>
  );
}
