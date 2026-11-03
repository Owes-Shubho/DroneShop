import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DroneImage, Loader, ErrorMsg } from '../../components/Bits.jsx';

const categories = ['Camera Drones', 'Racing Drones', 'Toy Drones', 'Industrial Drones', 'Accessories'];
const blank = {
  name: '', brand: '', category: categories[0], description: '', image: '', images: [], price: '', countInStock: '',
  specs: { flightTime: '', range: '', camera: '', weight: '' },
};

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(editing ? null : blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api(`/products/${id}`)
      .then((p) => setF({ ...blank, ...p, images: p.images || [], specs: { ...blank.specs, ...(p.specs || {}) } }))
      .catch((e) => setError(e.message));
  }, [id]);

  if (!f) return error ? <ErrorMsg error={error} /> : <Loader />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setSpec = (k) => (e) => setF({ ...f, specs: { ...f.specs, [k]: e.target.value } });

  // Uploads one file and returns its URL; `apply` stores it on the form.
  const upload = async (file, apply) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${user.token}` }, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setF((cur) => apply(cur, data.url));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };
  const uploadMain = (file) => upload(file, (cur, url) => ({ ...cur, image: url }));
  const uploadExtra = (files) => Array.from(files || []).forEach((file) =>
    upload(file, (cur, url) => ({ ...cur, images: [...(cur.images || []), url].slice(0, 8) })));
  const removeExtra = (url) => setF((cur) => ({ ...cur, images: cur.images.filter((u) => u !== url) }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { _id, __v, createdAt, updatedAt, reviews, rating, numReviews, ...data } = f;
    data.price = Number(data.price);
    data.countInStock = Number(data.countInStock);
    try {
      await api(editing ? `/products/${id}` : '/products', { method: editing ? 'PUT' : 'POST', token: user.token, body: data });
      nav('/admin/products');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <p><Link to="/admin/products">← Products</Link></p>
      <h1>{editing ? 'Edit product' : 'Add product'}</h1>
      <ErrorMsg error={error} />
      <form className="pform" onSubmit={submit}>
        <div className="panel">
          <h3>Details</h3>
          <label>Name<input required value={f.name} onChange={set('name')} /></label>
          <div className="two">
            <label>Brand<input required value={f.brand} onChange={set('brand')} /></label>
            <label>Category
              <select value={f.category} onChange={set('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
          </div>
          <div className="two">
            <label>Price (USD)<input required type="number" min="0" step="0.01" value={f.price} onChange={set('price')} /></label>
            <label>Stock<input required type="number" min="0" step="1" value={f.countInStock} onChange={set('countInStock')} /></label>
          </div>
          <label>Description<textarea required value={f.description} onChange={set('description')} /></label>

          <h3>Specs</h3>
          <div className="two">
            <label>Flight time<input placeholder="e.g. 34 min" value={f.specs.flightTime} onChange={setSpec('flightTime')} /></label>
            <label>Range<input placeholder="e.g. 10 km" value={f.specs.range} onChange={setSpec('range')} /></label>
            <label>Camera<input placeholder="e.g. 4K / 60fps" value={f.specs.camera} onChange={setSpec('camera')} /></label>
            <label>Weight<input placeholder="e.g. 249 g" value={f.specs.weight} onChange={setSpec('weight')} /></label>
          </div>
        </div>

        <div className="panel">
          <h3>Image</h3>
          <div className="preview"><DroneImage src={f.image} name={f.name || 'Product preview'} /></div>
          <label>Upload (JPG, PNG or WebP, max 5 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadMain(e.target.files[0])} disabled={uploading} />
          </label>
          {uploading && <small className="muted">Uploading…</small>}
          <label>…or paste an image URL / path
            <input placeholder="/images/drones/example.jpg" value={f.image} onChange={set('image')} />
          </label>
          {f.image && <button type="button" className="link danger" onClick={() => setF({ ...f, image: '' })}>Remove image</button>}
          <hr />
          <label>More photos (gallery, up to 8)
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { uploadExtra(e.target.files); e.target.value = ''; }} disabled={uploading || (f.images || []).length >= 8} />
          </label>
          {(f.images || []).length > 0 && (
            <div className="thumbs edit">
              {f.images.map((u) => (
                <div key={u} className="thumb-edit">
                  <img src={u} alt="" />
                  <button type="button" aria-label="Remove photo" onClick={() => removeExtra(u)}>×</button>
                </div>
              ))}
            </div>
          )}
          <hr />
          <button className="btn block-btn" disabled={busy || uploading}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button>
        </div>
      </form>
    </>
  );
}
