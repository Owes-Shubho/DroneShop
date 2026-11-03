import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

export default function Categories() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { _id, name }
  const [error, setError] = useState('');

  const load = () => api('/categories').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(err.message); }
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => { await api('/categories', { method: 'POST', token: user.token, body: { name } }); setName(''); });
  };
  const save = (e) => {
    e.preventDefault();
    run(async () => { await api(`/categories/${editing._id}`, { method: 'PUT', token: user.token, body: { name: editing.name } }); setEditing(null); });
  };
  const del = (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    run(() => api(`/categories/${c._id}`, { method: 'DELETE', token: user.token }));
  };

  return (
    <>
      <h1>Categories</h1>
      <ErrorMsg error={error} />
      <form className="toolbar" onSubmit={add}>
        <input required maxLength={40} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New category name" />
        <button className="btn">+ Add category</button>
      </form>

      {!list && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Products</th><th /></tr></thead>
          <tbody>
            {list?.length === 0 && <tr><td colSpan="3" className="muted">No categories yet.</td></tr>}
            {list?.map((c) => (
              <tr key={c._id}>
                <td>
                  {editing?._id === c._id ? (
                    <form className="row gap" onSubmit={save}>
                      <input required maxLength={40} autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Category name" />
                      <button className="btn small">Save</button>
                      <button type="button" className="btn ghost small" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : <strong>{c.name}</strong>}
                </td>
                <td>{c.productCount > 0 ? <Link to={`/admin/products?category=${encodeURIComponent(c.name)}`}>{c.productCount}</Link> : 0}</td>
                <td>
                  <div className="row gap">
                    <button className="link" onClick={() => setEditing({ _id: c._id, name: c.name })}>Rename</button>
                    <button className="link danger" onClick={() => del(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Renaming a category moves its products with it. A category with products cannot be deleted.</p>
    </>
  );
}
