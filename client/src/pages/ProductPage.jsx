import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { DroneImage, Stars, Loader, ErrorMsg, ProductCard } from '../components/Bits.jsx';
import { Check, Heart } from '../components/Icons.jsx';
import useTitle from '../useTitle.js';

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const { user, can } = useAuth();
  const wish = useWishlist();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  useTitle(p?.name, p && `${p.name} by ${p.brand} — ${p.description}`.slice(0, 155));

  const [related, setRelated] = useState([]);
  const [recent, setRecent] = useState([]);

  const load = () => api(`/products/${id}`).then(setP).catch((e) => setError(e.message));
  useEffect(() => { setShown(0); setQty(1); load(); }, [id]);

  // Related products, plus the products viewed before this one (kept in this browser only).
  useEffect(() => {
    let before = [];
    try { before = (JSON.parse(localStorage.getItem('recent')) || []).filter((x) => typeof x === 'string'); } catch { /* ignore */ }
    try { localStorage.setItem('recent', JSON.stringify([id, ...before.filter((x) => x !== id)].slice(0, 9))); } catch { /* storage unavailable */ }
    const others = before.filter((x) => x !== id).slice(0, 4);
    api(`/products/${id}/related`).then(setRelated).catch(() => setRelated([]));
    if (others.length) api(`/products/by-ids?ids=${others.join(',')}`).then(setRecent).catch(() => setRecent([]));
    else setRecent([]);
  }, [id]);

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewError('');
    try {
      await api(`/products/${id}/reviews`, { method: 'POST', token: user.token, body: { rating, comment } });
      setComment('');
      load();
    } catch (err) {
      setReviewError(err.message);
    }
  };

  const removeReview = async (rid) => {
    if (!confirm('Remove this review?')) return;
    try {
      await api(`/products/${id}/reviews/${rid}`, { method: 'DELETE', token: user.token });
      load();
    } catch (err) {
      setReviewError(err.message);
    }
  };

  const heart = async () => {
    if (!(await wish.toggle(id))) nav('/login');
  };

  if (error) return <ErrorMsg error={error} />;
  if (!p) return <Loader />;

  const gallery = [p.image, ...(p.images || [])].filter(Boolean);
  const saved = wish.has(p._id);

  return (
    <>
      <div className="detail">
        <div>
          <div className="gallery"><DroneImage src={gallery[shown]} name={p.name} /></div>
          {gallery.length > 1 && (
            <div className="thumbs">
              {gallery.map((src, i) => (
                <button key={src} className={i === shown ? 'on' : ''} onClick={() => setShown(i)} aria-label={`Show image ${i + 1}`}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="eyebrow-sm">{p.brand} · {p.category}{p.condition === 'Refurbished' && ' · Refurbished'}</span>
          <h1>{p.name}</h1>
          <Stars value={p.rating} count={p.numReviews} />
          <span className="price">{money(p.price)}</span>
          <p>{p.description}</p>
          <table className="specs">
            <tbody>
              {Object.entries(p.specs || {}).filter(([, v]) => v && v !== '-').map(([k, v]) => (
                <tr key={k}><th>{k.replace(/([A-Z])/g, ' $1')}</th><td>{v}</td></tr>
              ))}
              {(p.attributes || []).map((a) => <tr key={a.label}><th>{a.label}</th><td>{a.value}</td></tr>)}
              {p.modelNumber && <tr><th>Model</th><td>{p.modelNumber}</td></tr>}
              {p.mpn && <tr><th>Part number</th><td>{p.mpn}</td></tr>}
              {p.warrantyMonths > 0 && <tr><th>Warranty</th><td>{p.warrantyMonths} months</td></tr>}
              {p.sku && <tr><th>SKU</th><td>{p.sku}</td></tr>}
            </tbody>
          </table>
          {p.countInStock > 0 ? (
            <div className="buybox">
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Quantity">
                {Array.from({ length: Math.min(p.countInStock, 10) }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <button className="btn tint" onClick={() => add(p, qty)}>Add to cart</button>
              <button className="btn" onClick={() => { add(p, qty); nav('/cart'); }}>Buy now</button>
              <button className={`btn ghost icon-btn ${saved ? 'on' : ''}`} onClick={heart} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}>
                <Heart width={18} height={18} fill={saved ? 'currentColor' : 'none'} />
              </button>
              <small className="muted">{p.countInStock} in stock</small>
            </div>
          ) : (
            <div className="buybox">
              <span className="badge out">Out of stock</span>
              <button className={`btn ghost icon-btn ${saved ? 'on' : ''}`} onClick={heart} aria-pressed={saved} aria-label="Save to wishlist">
                <Heart width={18} height={18} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}
          <ul className="perks">
            <li><Check width={16} height={16} /> Free shipping on orders over $500</li>
            <li><Check width={16} height={16} /> 30-day returns</li>
            <li><Check width={16} height={16} /> Secure checkout</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2>You may also like</h2>
          <div className="grid">{related.map((r) => <ProductCard key={r._id} p={r} />)}</div>
        </section>
      )}
      {recent.length > 0 && (
        <section>
          <h2>Recently viewed</h2>
          <div className="grid">{recent.map((r) => <ProductCard key={r._id} p={r} />)}</div>
        </section>
      )}

      <h2>Reviews</h2>
      {p.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
      {p.reviews.map((r) => (
        <div key={r._id} className="review">
          <div className="row between">
            <span><strong>{r.name}</strong> <Stars value={r.rating} /></span>
            {can('products') && <button className="link danger" onClick={() => removeReview(r._id)}>Remove</button>}
          </div>
          <p>{r.comment}</p>
        </div>
      ))}
      <ErrorMsg error={reviewError} />
      {user ? (
        <form onSubmit={submitReview} className="form">
          <h3>Write a review</h3>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} aria-label="Rating">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
          </select>
          <textarea required value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Your review" />
          <button className="btn">Submit review</button>
        </form>
      ) : <p className="muted"><Link to="/login">Sign in</Link> to write a review.</p>}
    </>
  );
}
