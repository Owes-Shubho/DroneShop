import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';
import useTitle from '../../useTitle.js';

const blank = { name: '', logo: '', description: '' };

export default function Brands() {
  useTitle('Brands');
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // brand being added or edited
  const [error, setError] = useState('');

  const load = () => api('/brands').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(err.message); }
  };
  const save = (e) => {
    e.preventDefault();
    const { _id, name, logo, description } = form;
    run(async () => {
      await api(_id ? `/brands/${_id}` : '/brands', { method: _id ? 'PUT' : 'POST', token: user.token, body: { name, logo, description } });
      setForm(null);
    });
  };
  const del = (b) => {
    if (!confirm(`Delete brand "${b.name}"?`)) return;
    run(() => api(`/brands/${b._id}`, { method: 'DELETE', token: user.token }));
  };
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="row between wrap gap">
        <h1>Brands</h1>
        {!form && <button className="btn" onClick={() => setForm({ ...blank })}>+ Add brand</button>}
      </div>
      <ErrorMsg error={error} />

      {form && (
        <form className="panel pform-inline" onSubmit={save}>
          <h3>{form._id ? `Edit ${form.name}` : 'New brand'}</h3>
          <div className="two">
            <label>Name<input required maxLength={60} {...bind('name')} /></label>
            <label>Logo (image URL or path)<input placeholder="/images/brands/dji.png" {...bind('logo')} /></label>
          </div>
          <label>Description<textarea maxLength={500} {...bind('description')} /></label>
          <div className="row gap"><button className="btn">{form._id ? 'Save changes' : 'Create brand'}</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {!list && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Brand</th><th>Description</th><th>Products</th><th /></tr></thead>
          <tbody>
            {list?.length === 0 && <tr><td colSpan="4" className="muted">No brands yet.</td></tr>}
            {list?.map((b) => (
              <tr key={b._id}>
                <td>
                  <div className="row gap prod-cell">
                    {b.logo && <div className="thumb"><img className="pimg" src={b.logo} alt="" loading="lazy" /></div>}
                    <strong>{b.name}</strong>
                  </div>
                </td>
                <td className="muted">{b.description || '—'}</td>
                <td>{b.productCount > 0 ? <Link to={`/admin/products?brand=${encodeURIComponent(b.name)}`}>{b.productCount}</Link> : 0}</td>
                <td>
                  <div className="row gap">
                    <button className="link" onClick={() => setForm({ _id: b._id, name: b.name, logo: b.logo || '', description: b.description || '' })}>Edit</button>
                    <button className="link danger" onClick={() => del(b)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Renaming a brand moves its products with it. A brand with products cannot be deleted. A CSV import creates any brand it does not find.</p>
    </>
  );
}
