import { useEffect, useState } from 'react';
import { api } from './api.js';

// Brands from the API (empty until loaded). Pass `reload` to refetch after an admin edit.
export default function useBrands(reload) {
  const [list, setList] = useState([]);
  useEffect(() => {
    api('/brands').then(setList).catch(() => setList([]));
  }, [reload]);
  return list;
}
