import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import useCategories from '../../useCategories.js';
import useBrands from '../../useBrands.js';
import { money } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DroneImage, Loader, ErrorMsg } from '../../components/Bits.jsx';

const blank = {
  name: '', sku: '', brand: '', category: '', description: '', image: '', images: [], price: '', costPrice: '', countInStock: '',
  modelNumber: '', mpn: '', condition: 'New', warrantyMonths: 0, attributes: [],
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
  const categories = useCategories().map((c) => c.name);
  const brands = useBrands().map((b) => b.name);

  useEffect(() => {
    if (!editing) return;
    // The admin copy includes the purchase cost, which the public product API never sends.
    api(`/products/${id}/admin`, { token: user.token })
      .then((p) => setF({ ...blank, ...p, costPrice: p.costPrice ?? '', modelNumber: p.modelNumber || '', mpn: p.mpn || '', images: p.images || [], attributes: p.attributes || [], specs: { ...blank.specs, ...(p.specs || {}) } }))
      .catch((e) => setError(e.message));
  }, [id]);

  if (!f) return error ? <ErrorMsg error={error} /> : <Loader />;

  const price = Number(f.price);
  const margin = f.costPrice !== '' && price > 0 ? ((price - Number(f.costPrice)) / price) * 100 : null;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setAttr = (i, k) => (e) => setF({ ...f, attributes: f.attributes.map((a, j) => (j === i ? { ...a, [k]: e.target.value } : a)) });
  const addAttr = () => setF({ ...f, attributes: [...f.attributes, { label: '', value: '' }] });
  const removeAttr = (i) => setF({ ...f, attributes: f.attributes.filter((_, j) => j !== i) });
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
    data.costPrice = data.costPrice === '' ? '' : Number(data.costPrice);
    data.warrantyMonths = Number(data.warrantyMonths) || 0;
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
            <label>SKU
              <input placeholder="Leave blank to generate" maxLength={40} value={f.sku || ''} onChange={set('sku')} />
            </label>
            <label>Brand
              <select required value={f.brand} onChange={set('brand')}>
                <option value="" disabled>Choose…</option>
                {brands.map((b) => <option key={b}>{b}</option>)}
                {f.brand && !brands.includes(f.brand) && <option>{f.brand}</option>}
              </select>
              <small className="muted"><Link to="/admin/brands">Manage brands</Link></small>
            </label>
          </div>
          <div className="two">
            <label>Category
              <select required value={f.category} onChange={set('category')}>
                <option value="" disabled>Choose…</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="two">
            <label>Price (USD)<input required type="number" min="0" step="0.01" value={f.price} onChange={set('price')} /></label>
            <label>Purchase cost (USD)
              <input type="number" min="0" step="0.01" placeholder="Only staff see this" value={f.costPrice} onChange={set('costPrice')} />
              {margin !== null && <small className={margin < 0 ? 'error' : 'muted'}>Margin {margin.toFixed(1)}% · profit {money(Number(f.price) - Number(f.costPrice))} each</small>}
            </label>
            <label>Stock<input required type="number" min="0" step="1" value={f.countInStock} onChange={set('countInStock')} /></label>
          </div>
          <label>Description<textarea required value={f.description} onChange={set('description')} /></label>

          <h3>Drone details</h3>
          <div className="two">
            <label>Model number<input maxLength={60} value={f.modelNumber} onChange={set('modelNumber')} /></label>
            <label>Manufacturer part number<input maxLength={60} value={f.mpn} onChange={set('mpn')} /></label>
            <label>Condition
              <select value={f.condition} onChange={set('condition')}><option>New</option><option>Refurbished</option></select>
            </label>
            <label>Warranty (months)<input type="number" min="0" max="120" step="1" value={f.warrantyMonths} onChange={set('warrantyMonths')} /></label>
          </div>

          <h3>Specs</h3>
          <div className="two">
            <label>Flight time<input placeholder="e.g. 34 min" value={f.specs.flightTime} onChange={setSpec('flightTime')} /></label>
            <label>Range<input placeholder="e.g. 10 km" value={f.specs.range} onChange={setSpec('range')} /></label>
            <label>Camera<input placeholder="e.g. 4K / 60fps" value={f.specs.camera} onChange={setSpec('camera')} /></label>
            <label>Weight<input placeholder="e.g. 249 g" value={f.specs.weight} onChange={setSpec('weight')} /></label>
          </div>
          <h3>Technical attributes</h3>
          <p className="muted">Anything else that matters for this product, for example Motor KV, Battery capacity, Propeller size, ESC current, Voltage.</p>
          {f.attributes.map((a, i) => (
            <div key={i} className="attr-row">
              <input aria-label="Attribute name" placeholder="Name, e.g. Motor KV" maxLength={60} value={a.label} onChange={setAttr(i, 'label')} />
              <input aria-label="Attribute value" placeholder="Value, e.g. 2400" maxLength={200} value={a.value} onChange={setAttr(i, 'value')} />
              <button type="button" className="link danger" onClick={() => removeAttr(i)} aria-label="Remove attribute">Remove</button>
            </div>
          ))}
          {f.attributes.length < 30 && <button type="button" className="btn ghost small" onClick={addAttr}>+ Add attribute</button>}
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
