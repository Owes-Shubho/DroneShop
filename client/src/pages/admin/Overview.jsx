import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, statusClass } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

export default function Overview() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/stats', { token: user.token }).then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorMsg error={error} />;
  if (!s) return <Loader />;

  const max = Math.max(...s.last7.map((d) => d.revenue), 1);
  const week = s.last7.reduce((t, d) => t + d.revenue, 0);
  const kpis = [
    ['Revenue', money(s.revenue), 'excl. cancelled'],
    ['Orders', s.orderCount, `${s.byStatus.Processing || 0} processing`],
    ['Products', s.productCount, `${s.lowStock.length} low on stock`],
    ['Customers', s.userCount, 'registered'],
  ];

  return (
    <>
      <div className="row between wrap gap">
        <h1>Overview</h1>
        <Link to="/admin/products/new" className="btn">+ Add product</Link>
      </div>

      <div className="kpis">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="kpi"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
        ))}
      </div>

      <div className="admin-grid">
        <div className="panel">
          <div className="row between"><h3>Sales — last 7 days</h3><strong>{money(week)}</strong></div>
          <div className="bars" role="img" aria-label="Revenue per day for the last 7 days">
            {s.last7.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${money(d.revenue)} (${d.orders} orders)`}>
                <div className="bar" style={{ height: `${Math.max((d.revenue / max) * 100, d.revenue ? 4 : 1)}%` }} />
                <small>{day(d.date)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Orders by status</h3>
          {['Processing', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].map((st) => (
            <div key={st} className="row between status-row">
              <span className={`badge ${statusClass(st)}`}>{st}</span><strong>{s.byStatus[st] || 0}</strong>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="row between"><h3>Low stock</h3><Link to="/admin/products?stock=low">View all</Link></div>
          {s.lowStock.length === 0 && <p className="muted">Everything is well stocked.</p>}
          {s.lowStock.map((p) => (
            <div key={p._id} className="row between status-row">
              <Link to={`/admin/products/${p._id}`}>{p.name}</Link>
              <span className={`badge ${p.countInStock === 0 ? 'out' : 'Shipped'}`}>{p.countInStock === 0 ? 'Out' : `${p.countInStock} left`}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3>Best sellers</h3>
          {s.topProducts.length === 0 && <p className="muted">No sales yet.</p>}
          {s.topProducts.map((p) => (
            <div key={p._id} className="row between status-row">
              <Link to={`/product/${p._id}`}>{p.name}</Link>
              <span className="muted">{p.units} sold · {money(p.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="row between"><h3>Recent orders</h3><Link to="/admin/orders">View all</Link></div>
        {s.recent.length === 0 ? <p className="muted">No orders yet.</p> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {s.recent.map((o) => (
                <tr key={o._id}>
                  <td><Link to={`/orders/${o._id}`}>{o._id.slice(-8)}</Link></td>
                  <td>{o.user?.name || 'Deleted user'}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>{money(o.totalPrice)}</td>
                  <td><span className={`badge ${statusClass(o.status)}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
