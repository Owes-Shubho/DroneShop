import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { money } from '../api.js';
import { Drone, Heart } from './Icons.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCompare, MAX_COMPARE } from '../context/CompareContext.jsx';
import { useNavigate } from 'react-router-dom';

export function DroneImage({ src, name }) {
  if (src) return <img className="pimg" src={src} alt={name} loading="lazy" />;
  return (
    <div className="pimg placeholder" role="img" aria-label={name}>
      <Drone width={56} height={56} strokeWidth={1.5} />
    </div>
  );
}

export function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="stars" title={`${value.toFixed(1)} / 5`}>
      {'★'.repeat(full)}
      <span className="dim">{'★'.repeat(5 - full)}</span>
      {count !== undefined && <small> ({count})</small>}
    </span>
  );
}

export function ProductCard({ p }) {
  const { add } = useCart();
  const wish = useWishlist();
  const compare = useCompare();
  const comparing = compare.has(p._id);
  const nav = useNavigate();
  const saved = wish.has(p._id);
  const out = p.countInStock === 0;
  const low = !out && p.countInStock <= 5;
  return (
    <div className="card">
      <Link to={`/product/${p._id}`} className="card-media">
        {out && <span className="tag out">Out of stock</span>}
        {low && <span className="tag warn">Only {p.countInStock} left</span>}
        <DroneImage src={p.image} name={p.name} />
      </Link>
      <button
        className={`heart ${saved ? 'on' : ''}`}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
        onClick={async () => { if (!(await wish.toggle(p._id))) nav('/login'); }}
      >
        <Heart width={18} height={18} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="card-body">
        <span className="eyebrow-sm">{p.brand}</span>
        <Link to={`/product/${p._id}`} className="card-title">{p.name}</Link>
        <Stars value={p.rating} />
        <label className="compare-check">
          <input type="checkbox" checked={comparing}
            onChange={() => { if (!compare.toggle(p._id)) alert(`You can compare up to ${MAX_COMPARE} drones. Remove one first.`); }} />
          Compare
        </label>
        <div className="card-foot">
          <span className="price">{money(p.price)}</span>
          {!out && <button className="btn tint small" onClick={() => add(p)}>Add to cart</button>}
        </div>
      </div>
    </div>
  );
}

// `adminOnly` lets any staff role in; `permission` narrows it to roles that hold that permission.
export function Protected({ children, adminOnly, permission }) {
  const { user, can, isStaff } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isStaff) return <Navigate to="/" replace />;
  if (permission && !can(permission)) return <Navigate to="/admin" replace />;
  return children;
}

export const Loader = () => <p className="muted">Loading…</p>;
export const ErrorMsg = ({ error }) => (error ? <p className="error">{error}</p> : null);
