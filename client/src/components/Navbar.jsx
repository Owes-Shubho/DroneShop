import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Drone, Search, Cart, Heart } from './Icons.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const wish = useWishlist();
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    nav(`/shop?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="navbar">
      <div className="container row">
        <Link to="/" className="logo">
          <span className="logo-mark"><Drone width={18} height={18} /></span>SkyCart
        </Link>
        <form onSubmit={submit} className="search" role="search">
          <Search width={16} height={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drones, brands, accessories" aria-label="Search" />
        </form>
        <nav className="nav-links">
          <NavLink to="/shop">Shop</NavLink>
          {user?.isAdmin && <NavLink to="/admin">Admin</NavLink>}
          {user && <NavLink to="/orders">Orders</NavLink>}
          {user && (
            <NavLink to="/wishlist" aria-label="Wishlist">
              <Heart width={18} height={18} />
              {wish.ids.length > 0 && <span className="pill">{wish.ids.length}</span>}
            </NavLink>
          )}
          {user && <NavLink to="/account">Account</NavLink>}
          <NavLink to="/cart" aria-label="Cart">
            <Cart width={18} height={18} />
            {count > 0 && <span className="pill">{count}</span>}
          </NavLink>
          <ThemeToggle />
          {user ? (
            <button className="link" onClick={() => { logout(); nav('/'); }}>
              Logout ({user.name.split(' ')[0]})
            </button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
