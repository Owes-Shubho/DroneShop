import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg } from '../components/Bits.jsx';

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [addr, setAddr] = useState({ fullName: user.name, address: '', city: '', postalCode: '', country: '' });
  const [payment, setPayment] = useState('Cash on Delivery');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const shipping = subtotal > 500 ? 0 : 15;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const field = (k) => ({ value: addr[k], required: true, onChange: (e) => setAddr({ ...addr, [k]: e.target.value }) });

  if (items.length === 0) return <p>Your cart is empty.</p>;

  const place = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        token: user.token,
        body: {
          items: items.map(({ product, qty }) => ({ product, qty })),
          shippingAddress: addr,
          paymentMethod: payment,
        },
      });
      clear();
      nav(`/orders/${order._id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cart">
      <form className="form" onSubmit={place}>
        <h1>Checkout</h1>
        <ErrorMsg error={error} />
        <h3>Shipping address</h3>
        <input placeholder="Full name" {...field('fullName')} />
        <input placeholder="Address" {...field('address')} />
        <input placeholder="City" {...field('city')} />
        <input placeholder="Postal code" {...field('postalCode')} />
        <input placeholder="Country" {...field('country')} />
        <h3>Payment</h3>
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option>Cash on Delivery</option>
          <option>Card on Delivery</option>
        </select>
        <button className="btn" disabled={busy}>{busy ? 'Placing…' : 'Place order'}</button>
      </form>
      <div className="summary">
        <h3>Order summary</h3>
        {items.map((i) => (
          <div key={i.product} className="row between"><span>{i.name} × {i.qty}</span><span>{money(i.price * i.qty)}</span></div>
        ))}
        <hr />
        <div className="row between"><span>Items</span><span>{money(subtotal)}</span></div>
        <div className="row between"><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div>
        <div className="row between"><span>Tax (8%)</span><span>{money(tax)}</span></div>
        <div className="row between"><strong>Total</strong><strong>{money(subtotal + shipping + tax)}</strong></div>
        <small className="muted">Final prices are confirmed by the server.</small>
      </div>
    </div>
  );
}
