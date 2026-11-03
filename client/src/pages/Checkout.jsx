import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

const emptyAddr = (name = '') => ({ fullName: name, address: '', city: '', postalCode: '', country: '' });
const pick = ({ fullName, address, city, postalCode, country }) => ({ fullName, address, city, postalCode, country });

export default function Checkout() {
  useTitle('Checkout');
  const { items, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [saved, setSaved] = useState([]);
  const [addr, setAddr] = useState(emptyAddr(user.name));
  const [saveAddr, setSaveAddr] = useState(false);
  const [payment, setPayment] = useState('Cash on Delivery');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cartKey = items.map((i) => `${i.product}:${i.qty}`).join(',');
  const lines = items.map(({ product, qty }) => ({ product, qty }));

  useEffect(() => {
    api('/account/addresses', { token: user.token }).then((list) => {
      setSaved(list);
      const d = list.find((a) => a.isDefault);
      if (d) setAddr(pick(d));
    }).catch(() => {});
  }, []);

  // The server owns all pricing rules; the page only shows what it returns.
  useEffect(() => {
    if (!items.length) return;
    let live = true;
    api('/orders/quote', { method: 'POST', token: user.token, body: { items: lines, couponCode: code } })
      .then((q) => { if (live) { setQuote(q); setCouponError(''); } })
      .catch((err) => {
        if (!live) return;
        if (code) { setCouponError(err.message); setCode(''); } else setError(err.message);
      });
    return () => { live = false; };
  }, [cartKey, code]);

  if (items.length === 0) return <p>Your cart is empty.</p>;

  const field = (k, auto) => ({ value: addr[k], required: true, autoComplete: auto, onChange: (e) => setAddr({ ...addr, [k]: e.target.value }) });
  const applyCoupon = (e) => { e.preventDefault(); setCouponError(''); setCode(codeInput.trim().toUpperCase()); };

  const place = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        token: user.token,
        body: { items: lines, shippingAddress: addr, paymentMethod: payment, couponCode: code },
      });
      if (saveAddr) await api('/account/addresses', { method: 'POST', token: user.token, body: { ...addr, label: 'Saved at checkout' } }).catch(() => {});
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
        {saved.length > 0 && (
          <select aria-label="Use a saved address" value="" onChange={(e) => { const a = saved.find((s) => s._id === e.target.value); if (a) setAddr(pick(a)); }}>
            <option value="">Use a saved address…</option>
            {saved.map((a) => <option key={a._id} value={a._id}>{a.label} — {a.address}, {a.city}</option>)}
          </select>
        )}
        <input placeholder="Full name" {...field('fullName', 'name')} />
        <input placeholder="Address" {...field('address', 'street-address')} />
        <input placeholder="City" {...field('city', 'address-level2')} />
        <input placeholder="Postal code" {...field('postalCode', 'postal-code')} />
        <input placeholder="Country" {...field('country', 'country-name')} />
        <label className="check"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} /> Save this address to my account</label>
        <h3>Payment</h3>
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option>Cash on Delivery</option>
          <option>Card on Delivery</option>
        </select>
        <button className="btn" disabled={busy || !quote}>{busy ? 'Placing…' : 'Place order'}</button>
      </form>

      <div className="summary">
        <h3>Order summary</h3>
        {items.map((i) => (
          <div key={i.product} className="row between"><span>{i.name} × {i.qty}</span><span>{money(i.price * i.qty)}</span></div>
        ))}
        <hr />
        <form className="coupon" onSubmit={applyCoupon}>
          <input placeholder="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} aria-label="Coupon code" />
          <button className="btn ghost small" disabled={!codeInput.trim()}>Apply</button>
        </form>
        {couponError && <small className="error">{couponError}</small>}
        {quote?.coupon && <small className="ok">Coupon {quote.coupon.code} applied <button type="button" className="link" onClick={() => { setCode(''); setCodeInput(''); }}>remove</button></small>}
        <hr />
        {quote ? (
          <>
            <div className="row between"><span>Items</span><span>{money(quote.itemsPrice)}</span></div>
            {quote.discountPrice > 0 && <div className="row between ok"><span>Discount</span><span>−{money(quote.discountPrice)}</span></div>}
            <div className="row between"><span>Shipping</span><span>{quote.shippingPrice ? money(quote.shippingPrice) : 'Free'}</span></div>
            <div className="row between"><span>Tax (8%)</span><span>{money(quote.taxPrice)}</span></div>
            <div className="row between big-row"><strong>Total</strong><strong>{money(quote.totalPrice)}</strong></div>
          </>
        ) : <small className="muted">Calculating…</small>}
      </div>
    </div>
  );
}
