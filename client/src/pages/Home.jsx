import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ProductCard, Loader, ErrorMsg } from '../components/Bits.jsx';

const categories = ['Camera Drones', 'Racing Drones', 'Toy Drones', 'Industrial Drones', 'Accessories'];

export default function Home() {
  const [top, setTop] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/products/top').then(setTop).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Take to the sky.</h1>
        <p>Camera, racing, industrial and beginner drones — with accessories and fast shipping.</p>
        <Link to="/shop" className="btn">Shop all drones</Link>
      </section>

      <div className="promo">
        <strong>Free shipping on orders over $500</strong>
        <span>Applied automatically at checkout</span>
      </div>

      <h2>Browse by category</h2>
      <div className="cats">
        {categories.map((c) => (
          <Link key={c} className="cat" to={`/shop?category=${encodeURIComponent(c)}`}>{c}</Link>
        ))}
      </div>

      <h2>Top rated</h2>
      <ErrorMsg error={error} />
      {!top && !error ? <Loader /> : (
        <div className="grid">{top?.map((p) => <ProductCard key={p._id} p={p} />)}</div>
      )}
    </>
  );
}
