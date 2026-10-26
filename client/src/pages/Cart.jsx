import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { money } from '../api.js';
import { DroneImage } from '../components/Bits.jsx';

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart();
  const nav = useNavigate();

  if (items.length === 0) return <p>Your cart is empty. <Link to="/shop">Shop drones</Link></p>;

  return (
    <>
      <h1>Shopping cart</h1>
      <div className="cart">
        <div>
          {items.map((i) => (
            <div key={i.product} className="cart-item">
              <DroneImage src={i.image} name={i.name} />
              <Link to={`/product/${i.product}`}>{i.name}</Link>
              <span>{money(i.price)}</span>
              <select value={i.qty} onChange={(e) => setQty(i.product, Number(e.target.value))}>
                {Array.from({ length: Math.min(i.countInStock, 10) }, (_, n) => (
                  <option key={n} value={n + 1}>{n + 1}</option>
                ))}
              </select>
              <button className="link" onClick={() => remove(i.product)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="summary">
          <h3>Subtotal</h3>
          <p className="big">{money(subtotal)}</p>
          <small className="muted">Shipping and tax calculated at checkout.</small>
          <button className="btn" onClick={() => nav('/checkout')}>Proceed to checkout</button>
        </div>
      </div>
    </>
  );
}
