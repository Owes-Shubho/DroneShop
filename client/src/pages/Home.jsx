import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ProductCard, Loader, ErrorMsg } from '../components/Bits.jsx';
import { Truck, Shield, Refresh, Headset } from '../components/Icons.jsx';

const categories = [
  ['Camera Drones', '/images/drones/dji-mavic-air-2.jpg'],
  ['Racing Drones', '/images/drones/racing-drone.jpg'],
  ['Toy Drones', '/images/drones/toy-quadcopter.jpg'],
  ['Industrial Drones', '/images/drones/dji-agras-t50.jpg'],
  ['Accessories', '/images/drones/pelican-case.jpg'],
];

const perks = [
  [Truck, 'Free shipping', 'On orders over $500'],
  [Shield, 'Secure checkout', 'Prices verified server-side'],
  [Refresh, 'Easy returns', '30-day return window'],
  [Headset, 'Expert support', 'Help choosing your drone'],
];

export default function Home() {
  const [top, setTop] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/products/top').then(setTop).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">New season · 2026 lineup</span>
          <h1>Find the drone that fits the way you fly.</h1>
          <p>From pocket-sized travel drones to cinema rigs and farm sprayers — shop trusted brands with fast shipping.</p>
          <div className="actions">
            <Link to="/shop" className="btn light">Shop all drones</Link>
            <Link to="/shop?category=Camera%20Drones" className="btn ghost">Camera drones</Link>
          </div>
          <div className="stats">
            <div><strong>18+</strong><span>Models in stock</span></div>
            <div><strong>5</strong><span>Categories</span></div>
            <div><strong>$0</strong><span>Shipping over $500</span></div>
          </div>
        </div>
        <div className="hero-media">
          <img src="/images/drones/dji-mavic-3.jpg" alt="DJI Mavic 3 drone" />
        </div>
      </section>

      <div className="usp">
        {perks.map(([Icon, title, sub]) => (
          <div key={title}><Icon width={24} height={24} /><p style={{ margin: 0 }}><strong>{title}</strong><span>{sub}</span></p></div>
        ))}
      </div>

      <div className="section-head"><h2>Shop by category</h2><Link to="/shop">View all →</Link></div>
      <div className="cats">
        {categories.map(([name, img]) => (
          <Link key={name} className="cat" to={`/shop?category=${encodeURIComponent(name)}`}>
            <img src={img} alt="" loading="lazy" /><span>{name}</span>
          </Link>
        ))}
      </div>

      <div className="section-head"><h2>Top rated</h2><Link to="/shop?sort=rating">See more →</Link></div>
      <ErrorMsg error={error} />
      {!top && !error ? <Loader /> : (
        <div className="grid">{top?.map((p) => <ProductCard key={p._id} p={p} />)}</div>
      )}

      <section className="banner">
        <div>
          <h2>Not sure which drone to pick?</h2>
          <p>Start with the Mini line for travel, or filter by price and rating in the shop.</p>
        </div>
        <Link to="/shop?sort=price-asc" className="btn light">Browse by price</Link>
      </section>
    </>
  );
}
