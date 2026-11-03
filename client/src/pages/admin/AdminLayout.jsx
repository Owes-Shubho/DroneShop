import { NavLink, Outlet } from 'react-router-dom';

const links = [
  ['/admin', 'Overview', true],
  ['/admin/products', 'Products'],
  ['/admin/orders', 'Orders'],
  ['/admin/coupons', 'Coupons'],
  ['/admin/users', 'Customers'],
];

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin-nav">
        <h3>Dashboard</h3>
        {links.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </aside>
      <section className="admin-main"><Outlet /></section>
    </div>
  );
}
