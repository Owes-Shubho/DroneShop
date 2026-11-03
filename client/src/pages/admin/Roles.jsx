import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';
import { RoleBadge } from './Users.jsx';

// Read-only overview: roles are fixed, so this explains who can do what and how many people hold each role.
export default function Roles() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/roles', { token: user.token }).then(setData).catch((e) => setError(e.message));
  }, []);

  if (!data) return error ? <ErrorMsg error={error} /> : <Loader />;
  return (
    <>
      <h1>Roles and permissions</h1>
      <p className="muted">Assign a role from the <Link to="/admin/users">Users</Link> page. Only admins can change roles.</p>
      <div className="role-cards">
        {data.roles.map((r) => (
          <div key={r.name} className="panel">
            <div className="row between"><RoleBadge role={r.name} /><Link to={`/admin/users?role=${r.name}`}>{r.users} user{r.users === 1 ? '' : 's'}</Link></div>
            <p>{r.description}</p>
          </div>
        ))}
      </div>
      <div className="compare-scroll">
        <table className="table">
          <thead><tr><th>Permission</th>{data.roles.map((r) => <th key={r.name}>{r.label}</th>)}</tr></thead>
          <tbody>
            {Object.entries(data.permissions).map(([perm, text]) => (
              <tr key={perm}>
                <td>{text}</td>
                {data.roles.map((r) => (
                  <td key={r.name} aria-label={r.permissions.includes(perm) ? 'Allowed' : 'Not allowed'}>
                    {r.permissions.includes(perm) ? '✓' : <span className="muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
