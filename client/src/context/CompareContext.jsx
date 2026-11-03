import { createContext, useContext, useEffect, useState } from 'react';

const CompareContext = createContext(null);
export const useCompare = () => useContext(CompareContext);
export const MAX_COMPARE = 4;

// Products picked for side-by-side comparison; kept in this browser only.
export function CompareProvider({ children }) {
  const [ids, setIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('compare'));
      return Array.isArray(saved) ? saved.filter((i) => typeof i === 'string').slice(0, MAX_COMPARE) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('compare', JSON.stringify(ids)); } catch { /* storage unavailable */ }
  }, [ids]);

  const has = (id) => ids.includes(id);
  // Returns false when the list is full and the product was not added.
  const toggle = (id) => {
    if (has(id)) { setIds((cur) => cur.filter((i) => i !== id)); return true; }
    if (ids.length >= MAX_COMPARE) return false;
    setIds((cur) => [...cur, id]);
    return true;
  };
  const clear = () => setIds([]);

  return <CompareContext.Provider value={{ ids, has, toggle, clear }}>{children}</CompareContext.Provider>;
}
