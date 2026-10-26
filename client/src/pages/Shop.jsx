import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ProductCard, Loader, ErrorMsg } from '../components/Bits.jsx';

const categories = ['All', 'Camera Drones', 'Racing Drones', 'Toy Drones', 'Industrial Drones', 'Accessories'];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const qs = params.toString();
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    setData(null);
    setError('');
    api(`/products?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [qs]);

  return (
    <div className="shop">
      <aside className="filters">
        <h3>Category</h3>
        {categories.map((c) => (
          <button
            key={c}
            className={`link block ${(params.get('category') || 'All') === c ? 'active' : ''}`}
            onClick={() => set('category', c === 'All' ? '' : c)}
          >
            {c}
          </button>
        ))}
        <h3>Price</h3>
        <div className="row gap">
          <input type="number" placeholder="Min" defaultValue={params.get('minPrice') || ''}
            onBlur={(e) => set('minPrice', e.target.value)} />
          <input type="number" placeholder="Max" defaultValue={params.get('maxPrice') || ''}
            onBlur={(e) => set('maxPrice', e.target.value)} />
        </div>
        <h3>Sort</h3>
        <select value={params.get('sort') || ''} onChange={(e) => set('sort', e.target.value)}>
          <option value="">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </aside>

      <section>
        {params.get('search') && <p className="muted">Results for “{params.get('search')}”</p>}
        <ErrorMsg error={error} />
        {!data && !error && <Loader />}
        {data && (data.products.length === 0 ? <p>No products found.</p> : (
          <>
            <div className="grid">{data.products.map((p) => <ProductCard key={p._id} p={p} />)}</div>
            {data.pages > 1 && (
              <div className="row gap center pager">
                {Array.from({ length: data.pages }, (_, i) => (
                  <button key={i} className={`btn small ${data.page === i + 1 ? '' : 'ghost'}`}
                    onClick={() => set('page', String(i + 1))}>{i + 1}</button>
                ))}
              </div>
            )}
          </>
        ))}
      </section>
    </div>
  );
}
