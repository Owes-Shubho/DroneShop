import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/admin/users', { token: user.token }).then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const act = async (fn) => {
    setError('');
    try { await fn(); load(); } catch (err) { setError(err.message); }
  };
  const toggleAdmin = (u) =>
    act(() => api(`/admin/users/${u._id}/admin`, { method: 'PUT', token: user.token, body: { isAdmin: !u.isAdmin } }));
  const remove = (u) => {
    if (!confirm(`Delete ${u.email}? Their past orders are kept.`)) return;
    act(() => api(`/admin/users/${u._id}`, { method: 'DELETE', token: user.token }));
  };

  return (
    <>
      <h1>Customers</h1>
      <ErrorMsg error={error} />
      {!users && !error ? <Loader /> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Spent</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users?.map((u) => {
              const me = u._id === user._id;
              return (
                <tr key={u._id}>
                  <td>{u.name}{me && <small className="muted"> (you)</small>}</td>
                  <td>{u.email}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>{u.orders}</td>
                  <td>{money(u.spent)}</td>
                  <td><span className={`badge ${u.isAdmin ? '' : 'Delivered'}`}>{u.isAdmin ? 'Admin' : 'Customer'}</span></td>
                  <td>
                    {!me && (
                      <div className="row gap">
                        <button className="link" onClick={() => toggleAdmin(u)}>{u.isAdmin ? 'Remove admin' : 'Make admin'}</button>
                        <button className="link danger" onClick={() => remove(u)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
