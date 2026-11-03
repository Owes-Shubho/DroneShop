import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const lines = (items) => items.map((i) => ({ product: i.product, qty: i.qty }));

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState(null);
  // `ready` is true once the signed-in user's saved cart has been merged in; until then changes are not uploaded,
  // so an empty local cart can never overwrite the saved one.
  const ready = useRef(false);
  const token = user?.token;
  const userId = user?._id;
  const wasSignedIn = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(items)); } catch { /* storage unavailable */ }
  }, [items]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Sign in: merge this browser's cart into the saved one. Sign out: empty the cart for the next person.
  useEffect(() => {
    ready.current = false;
    if (!userId) {
      if (wasSignedIn.current) setItems([]);
      wasSignedIn.current = false;
      return;
    }
    wasSignedIn.current = true;
    let cancelled = false;
    (async () => {
      try {
        const saved = await api('/account/cart', { token });
        const local = JSON.parse(localStorage.getItem('cart') || '[]');
        const merged = new Map(saved.map((i) => [i.product, i]));
        for (const l of local) {
          const m = merged.get(l.product);
          merged.set(l.product, m ? { ...m, qty: Math.min(m.qty + l.qty, m.countInStock) } : l);
        }
        const next = await api('/account/cart', { method: 'PUT', token, body: { items: lines([...merged.values()]) } });
        if (cancelled) return;
        setItems(next);
        ready.current = true;
      } catch {
        if (!cancelled) ready.current = false; // offline or server error: keep the local cart, retry on next sign-in
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Upload changes (debounced) while signed in.
  useEffect(() => {
    if (!token || !ready.current) return;
    const t = setTimeout(() => {
      api('/account/cart', { method: 'PUT', token, body: { items: lines(items) } }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [items, token]);

  const add = (p, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product === p._id);
      if (found) {
        return prev.map((i) =>
          i.product === p._id ? { ...i, qty: Math.min(i.qty + qty, p.countInStock) } : i
        );
      }
      return [
        ...prev,
        { product: p._id, name: p.name, image: p.image, price: p.price, countInStock: p.countInStock, qty },
      ];
    });
    setNotice({ id: Date.now(), name: p.name });
  };
  const setQty = (id, qty) =>
    setItems((prev) => prev.map((i) => (i.product === id ? { ...i, qty } : i)));
  const remove = (id) => setItems((prev) => prev.filter((i) => i.product !== id));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal, notice }}>
      {children}
    </CartContext.Provider>
  );
}
