import { useEffect, useState } from 'react';
import { api } from './api.js';

// Category names from the API (empty until loaded). Pass `reload` to refetch after an admin edit.
export default function useCategories(reload) {
  const [list, setList] = useState([]);
  useEffect(() => {
    api('/categories').then(setList).catch(() => setList([]));
  }, [reload]);
  return list;
}
