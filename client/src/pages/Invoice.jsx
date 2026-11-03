import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

// A print-friendly invoice. Use the browser's "Save as PDF" in the print dialog to get a PDF.
export default function Invoice() {
  const { id } = useParams();
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  useTitle(o ? `Invoice ${o._id.slice(-8)}` : 'Invoice');

  useEffect(() => { api(`/orders/${id}`, { token: user.token }).then(setO).catch((e) => setError(e.message)); }, [id]);

  if (error) return <ErrorMsg error={error} />;
  if (!o) return <Loader />;
  const a = o.shippingAddress;

  return (
    <div className="invoice">
      <div className="no-print row between">
        <Link to={`/orders/${o._id}`}>← Back to order</Link>
        <button className="btn small" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <header className="row between">
        <div><h1>Invoice</h1><p className="muted">SkyCart Drone Shop</p></div>
        <div className="right">
          <strong>#{o._id.slice(-8).toUpperCase()}</strong>
          <p className="muted">{new Date(o.createdAt).toLocaleDateString()}</p>
        </div>
      </header>
      <div className="two">
        <div><h3>Bill / ship to</h3><p>{a.fullName}<br />{a.address}<br />{a.city} {a.postalCode}<br />{a.country}</p></div>
        <div><h3>Payment</h3><p>{o.paymentMethod}<br />{o.isPaid ? `Paid ${new Date(o.paidAt).toLocaleDateString()}` : 'Payment due on delivery'}<br />Status: {o.status}</p></div>
      </div>
      <table className="table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i._id}><td>{i.name}</td><td>{i.qty}</td><td>{money(i.price)}</td><td>{money(i.price * i.qty)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="inv-totals">
        <div className="row between"><span>Items</span><span>{money(o.itemsPrice)}</span></div>
        {o.discountPrice > 0 && <div className="row between"><span>Discount{o.coupon?.code ? ` (${o.coupon.code})` : ''}</span><span>−{money(o.discountPrice)}</span></div>}
        <div className="row between"><span>Shipping</span><span>{o.shippingPrice ? money(o.shippingPrice) : 'Free'}</span></div>
        <div className="row between"><span>Tax</span><span>{money(o.taxPrice)}</span></div>
        <div className="row between big-row"><strong>Total</strong><strong>{money(o.totalPrice)}</strong></div>
      </div>
    </div>
  );
}
