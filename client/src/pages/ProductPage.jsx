import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { DroneImage, Stars, Loader, ErrorMsg } from '../components/Bits.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  const load = () => api(`/products/${id}`).then(setP).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

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

  if (error) return <ErrorMsg error={error} />;
  if (!p) return <Loader />;

  return (
    <>
      <div className="detail">
        <DroneImage src={p.image} name={p.name} />
        <div>
          <small className="muted">{p.brand} · {p.category}</small>
          <h1>{p.name}</h1>
          <Stars value={p.rating} count={p.numReviews} />
          <h2>{money(p.price)}</h2>
          <p>{p.description}</p>
          <table className="specs">
            <tbody>
              {Object.entries(p.specs || {}).filter(([, v]) => v && v !== '-').map(([k, v]) => (
                <tr key={k}><th>{k.replace(/([A-Z])/g, ' $1')}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
          {p.countInStock > 0 ? (
            <div className="row gap">
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: Math.min(p.countInStock, 10) }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <button className="btn" onClick={() => { add(p, qty); nav('/cart'); }}>Add to cart</button>
              <small className="muted">{p.countInStock} in stock</small>
            </div>
          ) : <span className="badge out">Out of stock</span>}
        </div>
      </div>

      <h2>Reviews</h2>
      {p.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
      {p.reviews.map((r) => (
        <div key={r._id} className="review">
          <strong>{r.name}</strong> <Stars value={r.rating} />
          <p>{r.comment}</p>
        </div>
      ))}
      {user ? (
        <form onSubmit={submitReview} className="form">
          <h3>Write a review</h3>
          <ErrorMsg error={reviewError} />
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
          </select>
          <textarea required value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Your review" />
          <button className="btn">Submit review</button>
        </form>
      ) : <p className="muted">Sign in to write a review.</p>}
    </>
  );
}
