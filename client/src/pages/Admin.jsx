import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg } from '../components/Bits.jsx';

const categories = ['Camera Drones', 'Racing Drones', 'Toy Drones', 'Industrial Drones', 'Accessories'];
const blank = { name: '', brand: '', category: categories[0], description: '', image: '', price: '', countInStock: '' };

function Products({ token }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null); // null = hidden, object = create/edit
  const [error, setError] = useState('');

  const load = () => api('/products?limit=50').then((d) => setList(d.products)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const { _id, ...data } = form;
    data.price = Number(data.price);
    data.countInStock = Number(data.countInStock);
    try {
      await api(_id ? `/products/${_id}` : '/products', { method: _id ? 'PUT' : 'POST', token, body: data });
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this product?')) return;
    try { await api(`/products/${id}`, { method: 'DELETE', token }); load(); } catch (err) { setError(err.message); }
  };

  const bind = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="row between"><h2>Products</h2><button className="btn small" onClick={() => setForm({ ...blank })}>+ New</button></div>
      <ErrorMsg error={error} />
      {form && (
        <form className="form" onSubmit={save}>
          <input required placeholder="Name" {...bind('name')} />
          <input required placeholder="Brand" {...bind('brand')} />
          <select {...bind('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <input placeholder="Image URL (optional)" {...bind('image')} />
          <input required type="number" min="0" step="0.01" placeholder="Price" {...bind('price')} />
          <input required type="number" min="0" placeholder="Stock" {...bind('countInStock')} />
          <textarea required placeholder="Description" {...bind('description')} />
          <div className="row gap">
            <button className="btn">{form._id ? 'Update' : 'Create'}</button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      <table className="table">
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p._id}>
              <td>{p.name}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.countInStock}</td>
              <td className="row gap">
                <button className="link" onClick={() => setForm(p)}>Edit</button>
                <button className="link danger" onClick={() => del(p._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Orders({ token }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const load = () => api('/orders', { token }).then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    try { await api(`/orders/${id}/status`, { method: 'PUT', token, body: { status } }); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <h2>Orders</h2>
      <ErrorMsg error={error} />
      <table className="table">
        <thead><tr><th>ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td>{o._id.slice(-8)}</td>
              <td>{o.user?.name || 'Deleted user'}</td>
              <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              <td>{money(o.totalPrice)}</td>
              <td>
                <select value={o.status} onChange={(e) => setStatus(o._id, e.target.value)}>
                  {['Processing', 'Shipped', 'Delivered', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td><Link to={`/orders/${o._id}`}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');
  return (
    <>
      <h1>Admin dashboard</h1>
      <div className="row gap tabs">
        <button className={`link ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
        <button className={`link ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Orders</button>
      </div>
      {tab === 'products' ? <Products token={user.token} /> : <Orders token={user.token} />}
    </>
  );
}
