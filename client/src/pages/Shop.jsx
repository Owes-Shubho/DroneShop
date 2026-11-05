import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import useCategories from '../useCategories.js';
import useBrands from '../useBrands.js';
import { ProductCard, Loader, ErrorMsg } from '../components/Bits.jsx';

export default function Shop() {
  const categories = ['All', ...useCategories().map((c) => c.name)];
  const brands = useBrands().filter((b) => b.productCount > 0);
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
        {brands.length > 1 && (
          <>
            <h3>Brand</h3>
            <select value={params.get('brand') || ''} onChange={(e) => set('brand', e.target.value)} aria-label="Brand">
              <option value="">All brands</option>
              {brands.map((b) => <option key={b._id} value={b.name}>{b.name} ({b.productCount})</option>)}
            </select>
          </>
        )}
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
        <div className="page-head">
          <h1>{[params.get('brand'), params.get('category')].filter(Boolean).join(' · ') || 'All drones'}</h1>
          <p className="results">
            {data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}
            {params.get('search') && ` for “${params.get('search')}”`}
          </p>
        </div>
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
