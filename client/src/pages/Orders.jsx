import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, statusClass } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

export function MyOrders() {
  useTitle('My orders');
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders/mine', { token: user.token }).then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorMsg error={error} />;
  if (!orders) return <Loader />;
  return (
    <>
      <h1>My orders</h1>
      {orders.length === 0 ? <p>No orders yet. <Link to="/shop">Start shopping</Link></p> : (
        <table className="table">
          <thead><tr><th>ID</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td>{o._id.slice(-8)}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{money(o.totalPrice)}</td>
                <td><span className={`badge ${statusClass(o.status)}`}>{o.status}</span></td>
                <td><Link to={`/orders/${o._id}`}>Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const [note, setNote] = useState('');
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  useTitle(o ? `Order ${o._id.slice(-8)}` : 'Order');

  useEffect(() => {
    api(`/orders/${id}`, { token: user.token }).then(setO).catch((e) => setError(e.message));
  }, [id]);

  const cancel = async () => {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/orders/${id}/cancel`, { method: 'PUT', token: user.token });
      setO((cur) => ({ ...cur, ...updated, user: cur.user }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const requestReturn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/orders/${id}/return`, { method: 'POST', token: user.token, body: { reason } });
      setO((cur) => ({ ...cur, ...updated, user: cur.user }));
      setAsking(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/orders/${id}/notes`, { method: 'POST', token: user.token, body: { text: note } });
      setO((cur) => ({ ...cur, notes: updated.notes }));
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!o) return error ? <ErrorMsg error={error} /> : <Loader />;
  const staff = can('orders');
  const a = o.shippingAddress;
  const rr = o.returnRequest;
  const mine = o.user?._id === user._id;
  const t = o.tracking;
  const safeTrackUrl = t?.url && /^https?:\/\//i.test(t.url) ? t.url : null;

  return (
    <>
      <div className="row between wrap gap">
        <h1>Order {o._id.slice(-8)}</h1>
        <div className="row gap">
          <Link to={`/orders/${o._id}/invoice`} className="btn ghost small">Invoice</Link>
          {staff && <Link to={`/orders/${o._id}/packing-slip`} className="btn ghost small">Packing slip</Link>}
          {['Processing', 'Confirmed'].includes(o.status) && mine && (
            <button className="btn ghost small" onClick={cancel} disabled={busy}>Cancel order</button>
          )}
          {o.status === 'Delivered' && mine && !rr?.status && !asking && (
            <button className="btn ghost small" onClick={() => setAsking(true)}>Return items</button>
          )}
        </div>
      </div>
      <ErrorMsg error={error} />
      <p><span className={`badge ${statusClass(o.status)}`}>{o.status}</span> · Placed {new Date(o.createdAt).toLocaleString()}</p>

      {o.statusHistory?.length > 0 && (
        <div className="panel">
          <h3>Order progress</h3>
          <ul className="timeline">
            {o.statusHistory.map((h, i) => (
              <li key={i}><strong>{h.status}</strong> <span className="muted">{new Date(h.at).toLocaleString()}{staff && h.byName ? ` · ${h.byName}` : ''}</span></li>
            ))}
          </ul>
        </div>
      )}

      {staff && (
        <div className="panel">
          <h3>Internal notes <small className="muted">(staff only, customers never see these)</small></h3>
          {(o.notes || []).length === 0 && <p className="muted">No notes yet.</p>}
          {(o.notes || []).map((n, i) => (
            <div key={i} className="note">{n.text}<br /><small>{n.byName || 'Staff'} · {new Date(n.at).toLocaleString()}</small></div>
          ))}
          <form onSubmit={addNote} className="form">
            <textarea required maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the team" aria-label="New internal note" />
            <button className="btn small" disabled={busy}>Add note</button>
          </form>
        </div>
      )}

      {asking && (
        <form className="panel pform-inline" onSubmit={requestReturn}>
          <h3>Return this order</h3>
          <label>Why are you returning it?
            <textarea required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong item, changed my mind…" />
          </label>
          <p className="muted">Returns are accepted within 30 days of delivery. We will review your request and reply here.</p>
          <div className="row gap"><button className="btn" disabled={busy}>Send request</button><button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancel</button></div>
        </form>
      )}
      {rr?.status && (
        <div className="panel">
          <h3>Return <span className={`badge ${rr.status}`}>{rr.status}</span></h3>
          <p>Your reason: {rr.reason}</p>
          {rr.note && <p>Store reply: {rr.note}</p>}
          {rr.status === 'Refunded' && <p>Refunded {money(o.totalPrice)}.</p>}
        </div>
      )}

      {t?.number && (
        <div className="panel tracking">
          <h3>Tracking</h3>
          <p>{t.carrier || 'Carrier'} — <strong>{t.number}</strong>{safeTrackUrl && <> · <a href={safeTrackUrl} target="_blank" rel="noopener noreferrer">Track package</a></>}</p>
        </div>
      )}

      <div className="cart">
        <div>
          <h3>Ship to</h3>
          <p>{a.fullName}<br />{a.address}, {a.city} {a.postalCode}, {a.country}</p>
          <h3>Payment</h3>
          <p>{o.paymentMethod} — {o.isPaid ? `Paid ${new Date(o.paidAt).toLocaleDateString()}` : 'Not paid yet'}</p>
          <h3>Items</h3>
          {o.items.map((i) => (
            <div key={i._id} className="row between">
              <Link to={`/product/${i.product}`}>{i.name} × {i.qty}</Link>
              <span>{money(i.price * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="summary">
          <div className="row between"><span>Items</span><span>{money(o.itemsPrice)}</span></div>
          {o.discountPrice > 0 && <div className="row between ok"><span>Discount{o.coupon?.code ? ` (${o.coupon.code})` : ''}</span><span>−{money(o.discountPrice)}</span></div>}
          <div className="row between"><span>Shipping</span><span>{o.shippingPrice ? money(o.shippingPrice) : 'Free'}</span></div>
          <div className="row between"><span>Tax</span><span>{money(o.taxPrice)}</span></div>
          <div className="row between big-row"><strong>Total</strong><strong>{money(o.totalPrice)}</strong></div>
        </div>
      </div>
    </>
  );
}
