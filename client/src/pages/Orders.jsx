import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../components/Bits.jsx';

export function MyOrders() {
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
                <td><span className={`badge ${o.status}`}>{o.status}</span></td>
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
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${id}`, { token: user.token }).then(setO).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorMsg error={error} />;
  if (!o) return <Loader />;
  const a = o.shippingAddress;
  return (
    <>
      <h1>Order {o._id.slice(-8)}</h1>
      <p><span className={`badge ${o.status}`}>{o.status}</span> · Placed {new Date(o.createdAt).toLocaleString()}</p>
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
          <div className="row between"><span>Shipping</span><span>{money(o.shippingPrice)}</span></div>
          <div className="row between"><span>Tax</span><span>{money(o.taxPrice)}</span></div>
          <div className="row between"><strong>Total</strong><strong>{money(o.totalPrice)}</strong></div>
        </div>
      </div>
    </>
  );
}
