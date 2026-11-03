import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, download } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

const statuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('');
  const [ship, setShip] = useState(null); // order being given tracking details
  const [error, setError] = useState('');

  const load = () => api('/orders', { token: user.token }).then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (orders || []).filter((o) => !filter || o.status === filter), [orders, filter]);

  const setStatus = async (o, status) => {
    if (status === 'Cancelled' && !confirm('Cancel this order? Stock will be returned and it cannot be reopened.')) return;
    setError('');
    try {
      await api(`/orders/${o._id}/status`, { method: 'PUT', token: user.token, body: { status } });
      load();
    } catch (err) { setError(err.message); }
  };

  const saveTracking = async (e) => {
    e.preventDefault();
    setError('');
    const { _id, carrier, number, url } = ship;
    try {
      await api(`/orders/${_id}/tracking`, { method: 'PUT', token: user.token, body: { carrier, number, url } });
      setShip(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const decide = async (o, decision) => {
    if (decision === 'refund' && !confirm(`Refund ${money(o.totalPrice)} and put the items back in stock?`)) return;
    const note = decision === 'refund' ? '' : (prompt('Message to the customer (optional)') ?? null);
    if (note === null) return;
    setError('');
    try {
      await api(`/orders/${o._id}/return`, { method: 'PUT', token: user.token, body: { decision, note } });
      load();
    } catch (err) { setError(err.message); }
  };

  const exportCsv =() => download('/admin/export/orders.csv', 'orders.csv', user.token).catch((e) => setError(e.message));

  return (
    <>
      <div className="row between wrap gap">
        <h1>Orders</h1>
        <div className="row gap">
          <button className="btn ghost small" onClick={exportCsv}>Export CSV</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <ErrorMsg error={error} />

      {ship && (
        <form className="panel pform-inline" onSubmit={saveTracking}>
          <h3>Shipment for order {ship._id.slice(-8)}</h3>
          <div className="two">
            <label>Carrier<input placeholder="UPS, FedEx, DHL…" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} /></label>
            <label>Tracking number<input required value={ship.number} onChange={(e) => setShip({ ...ship, number: e.target.value })} /></label>
          </div>
          <label>Tracking link (optional)<input type="url" placeholder="https://…" value={ship.url} onChange={(e) => setShip({ ...ship, url: e.target.value })} /></label>
          <p className="muted">Saving marks a processing order as shipped and emails the customer.</p>
          <div className="row gap"><button className="btn">Save shipment</button><button type="button" className="btn ghost" onClick={() => setShip(null)}>Cancel</button></div>
        </form>
      )}

      {!orders && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th>Shipment</th><th>Return</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="9" className="muted">No orders.</td></tr>}
            {rows.map((o) => (
              <tr key={o._id}>
                <td><Link to={`/orders/${o._id}`}>{o._id.slice(-8)}</Link></td>
                <td>{o.user?.name || 'Deleted user'}<br /><small className="muted">{o.user?.email}</small></td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td>{money(o.totalPrice)}{o.discountPrice > 0 && <><br /><small className="muted">{o.coupon?.code}</small></>}</td>
                <td>{o.isPaid ? 'Yes' : 'No'}</td>
                <td>
                  <select value={o.status} disabled={o.status === 'Cancelled'} onChange={(e) => setStatus(o, e.target.value)} aria-label={`Status of order ${o._id.slice(-8)}`}>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  {o.status === 'Cancelled' ? '—' : (
                    <button className="link" onClick={() => setShip({ _id: o._id, carrier: o.tracking?.carrier || '', number: o.tracking?.number || '', url: o.tracking?.url || '' })}>
                      {o.tracking?.number ? o.tracking.number : 'Add tracking'}
                    </button>
                  )}
                </td>
                <td>
                  {o.returnRequest?.status ? (
                    <>
                      <span className={`badge ${o.returnRequest.status}`}>{o.returnRequest.status}</span>
                      <br /><small className="muted" title={o.returnRequest.reason}>{o.returnRequest.reason.slice(0, 40)}</small>
                      <div className="row gap">
                        {o.returnRequest.status === 'Requested' && <>
                          <button className="link" onClick={() => decide(o, 'approve')}>Approve</button>
                          <button className="link danger" onClick={() => decide(o, 'reject')}>Reject</button>
                        </>}
                        {['Requested', 'Approved'].includes(o.returnRequest.status) && <button className="link" onClick={() => decide(o, 'refund')}>Refund</button>}
                      </div>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
