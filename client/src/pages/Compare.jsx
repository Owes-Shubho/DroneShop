import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCompare } from '../context/CompareContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { DroneImage, Stars, Loader, ErrorMsg } from '../components/Bits.jsx';
import useTitle from '../useTitle.js';

const rows = [
  ['Brand', (p) => p.brand],
  ['Category', (p) => p.category],
  ['Price', (p) => money(p.price)],
  ['Rating', (p) => <Stars value={p.rating} count={p.numReviews} />],
  ['Flight time', (p) => p.specs?.flightTime],
  ['Range', (p) => p.specs?.range],
  ['Camera', (p) => p.specs?.camera],
  ['Weight', (p) => p.specs?.weight],
  ['Availability', (p) => (p.countInStock > 0 ? 'In stock' : 'Out of stock')],
];
const show = (v) => (v && v !== '-' ? v : '—');

export default function Compare() {
  useTitle('Compare drones');
  const { ids, toggle, clear } = useCompare();
  const { add } = useCart();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) return setProducts([]);
    api(`/products/by-ids?ids=${key}`).then(setProducts).catch((e) => setError(e.message));
  }, [key]);

  if (error) return <ErrorMsg error={error} />;
  if (!products) return <Loader />;
  if (products.length === 0) {
    return <><h1>Compare drones</h1><p>Nothing to compare yet. Use “Compare” on product cards to pick up to 4 drones. <Link to="/shop">Browse the shop</Link></p></>;
  }

  return (
    <>
      <div className="row between wrap gap">
        <h1>Compare drones</h1>
        <button className="btn ghost small" onClick={clear}>Clear all</button>
      </div>
      <div className="compare-scroll">
        <table className="table compare">
          <thead>
            <tr>
              <th />
              {products.map((p) => (
                <th key={p._id}>
                  <div className="thumb big"><DroneImage src={p.image} name={p.name} /></div>
                  <Link to={`/product/${p._id}`}>{p.name}</Link>
                  <div><button className="link danger" onClick={() => toggle(p._id)}>Remove</button></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {products.map((p) => <td key={p._id}>{typeof get(p) === 'object' ? get(p) : show(get(p))}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row" />
              {products.map((p) => (
                <td key={p._id}>{p.countInStock > 0 && <button className="btn tint small" onClick={() => add(p)}>Add to cart</button>}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
