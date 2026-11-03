import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { ProductCard, Loader, ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

export default function Wishlist() {
  useTitle('Wishlist');
  const { user } = useAuth();
  const { ids } = useWishlist();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  // Re-fetch whenever a heart is toggled so removed items disappear.
  useEffect(() => {
    api('/account/wishlist', { token: user.token }).then(setItems).catch((e) => setError(e.message));
  }, [ids.length]);

  return (
    <>
      <h1>Wishlist</h1>
      <ErrorMsg error={error} />
      {!items && !error ? <Loader /> : items?.length === 0 ? (
        <p className="muted">Nothing saved yet. Tap the heart on any product to save it. <Link to="/shop">Browse drones</Link></p>
      ) : (
        <div className="grid">{items?.map((p) => <ProductCard key={p._id} p={p} />)}</div>
      )}
    </>
  );
}
