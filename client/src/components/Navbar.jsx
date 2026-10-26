import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    nav(`/shop?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="navbar">
      <div className="container row between">
        <Link to="/" className="logo">✈ SkyCart</Link>
        <form onSubmit={submit} className="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drones…" />
        </form>
        <nav className="row gap">
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/cart">Cart{count > 0 && <span className="pill">{count}</span>}</NavLink>
          {user ? (
            <>
              {user.isAdmin && <NavLink to="/admin">Admin</NavLink>}
              <NavLink to="/orders">Orders</NavLink>
              <button className="link" onClick={() => { logout(); nav('/'); }}>
                Logout ({user.name.split(' ')[0]})
              </button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
