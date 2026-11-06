import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

// Staff print this and put it in the parcel: what to pick, where it goes. No prices.
export default function PackingSlip() {
  const { id } = useParams();
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  useTitle(o ? `Packing slip ${o._id.slice(-8)}` : 'Packing slip');

  useEffect(() => {
    api(`/orders/${id}`, { token: user.token }).then(setO).catch((e) => setError(e.message));
  }, [id]);

  if (!o) return error ? <ErrorMsg error={error} /> : <Loader />;
  const a = o.shippingAddress;
  const units = o.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="slip">
      <div className="row between no-print">
        <Link to={`/orders/${o._id}`}>← Order</Link>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>
      <h1>Packing slip</h1>
      <p>
        <strong>Order {o._id.slice(-8)}</strong> · {new Date(o.createdAt).toLocaleDateString()} · {o.status}<br />
        {units} item{units === 1 ? '' : 's'} · {o.paymentMethod}{!o.isPaid && ' · collect payment on delivery'}
      </p>
      <h3>Ship to</h3>
      <p>{a.fullName}<br />{a.address}<br />{a.city} {a.postalCode}<br />{a.country}</p>
      <table>
        <thead><tr><th>Packed</th><th>SKU</th><th>Item</th><th>Qty</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i._id}>
              <td><span className="box" aria-hidden="true" /></td>
              <td>{i.sku || '—'}</td>
              <td>{i.name}</td>
              <td><strong>{i.qty}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.tracking?.number && <p>Carrier: {o.tracking.carrier || '—'} · Tracking {o.tracking.number}</p>}
      <p className="muted">Thank you for shopping with SkyCart.</p>
    </div>
  );
}
