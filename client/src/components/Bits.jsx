import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { money } from '../api.js';

export function DroneImage({ src, name }) {
  if (src) return <img className="pimg" src={src} alt={name} />;
  return (
    <div className="pimg placeholder" role="img" aria-label={name}>
      <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="14" r="7" /><circle cx="52" cy="14" r="7" />
        <circle cx="12" cy="50" r="7" /><circle cx="52" cy="50" r="7" />
        <path d="M17 19l10 8M47 19L37 27M17 45l10-8M47 45L37 37" />
        <rect x="26" y="26" width="12" height="12" rx="3" />
      </svg>
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
  return (
    <div className="card">
      <Link to={`/product/${p._id}`}>
        <DroneImage src={p.image} name={p.name} />
      </Link>
      <div className="card-body">
        <small className="muted">{p.brand} · {p.category}</small>
        <Link to={`/product/${p._id}`} className="card-title">{p.name}</Link>
        <Stars value={p.rating} />
        <div className="row between">
          <strong>{money(p.price)}</strong>
          {p.countInStock > 0 ? (
            <button className="btn small" onClick={() => add(p)}>Add</button>
          ) : (
            <span className="badge out">Out of stock</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Protected({ children, adminOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

export const Loader = () => <p className="muted">Loading…</p>;
export const ErrorMsg = ({ error }) => (error ? <p className="error">{error}</p> : null);
