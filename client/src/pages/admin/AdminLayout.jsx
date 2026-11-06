import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Overview from './Overview.jsx';

// [path, label, permission required, exact match]
export const links = [
  ['/admin', 'Overview', 'dashboard', true],
  ['/admin/reports', 'Reports', 'reports'],
  ['/admin/products', 'Products', 'products'],
  ['/admin/categories', 'Categories', 'products'],
  ['/admin/brands', 'Brands', 'products'],
  ['/admin/inventory', 'Inventory', 'inventory'],
  ['/admin/orders', 'Orders', 'orders'],
  ['/admin/coupons', 'Coupons', 'coupons'],
  ['/admin/users', 'Users', 'users.view'],
  ['/admin/roles', 'Roles', 'users.view'],
];

// Dashboard landing page: the overview for roles that can see it, otherwise their first allowed section.
export function AdminHome() {
  const { can } = useAuth();
  if (can('dashboard')) return <Overview />;
  const first = links.find(([, , perm]) => can(perm));
  return first ? <Navigate to={first[0]} replace /> : <Navigate to="/" replace />;
}

export default function AdminLayout() {
  const { user, can } = useAuth();
  return (
    <div className="admin">
      <aside className="admin-nav">
        <h3>Dashboard</h3>
        <small className="muted role-line">Signed in as {user.role || (user.isAdmin ? 'admin' : 'staff')}</small>
        {links.filter(([, , perm]) => can(perm)).map(([to, label, , end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </aside>
      <section className="admin-main"><Outlet /></section>
    </div>
  );
}
