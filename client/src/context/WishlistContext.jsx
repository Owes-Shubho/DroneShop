import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);
export const useWishlist = () => useContext(WishlistContext);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState([]);

  useEffect(() => {
    if (!user) return setIds([]);
    api('/account/wishlist/ids', { token: user.token }).then(setIds).catch(() => setIds([]));
  }, [user?._id]);

  const has = (id) => ids.includes(id);

  // Returns false when the visitor must sign in first.
  const toggle = async (id) => {
    if (!user) return false;
    const next = await api(`/account/wishlist/${id}`, { method: has(id) ? 'DELETE' : 'POST', token: user.token });
    setIds(next);
    return true;
  };

  return <WishlistContext.Provider value={{ ids, has, toggle }}>{children}</WishlistContext.Provider>;
}
