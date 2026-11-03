import { Link, useLocation } from 'react-router-dom';
import { useCompare } from '../context/CompareContext.jsx';

// Sticky bar shown while products are picked for comparison.
export default function CompareBar() {
  const { ids, clear } = useCompare();
  const { pathname } = useLocation();
  if (!ids.length || pathname === '/compare') return null;
  return (
    <div className="compare-bar" role="region" aria-label="Compare list">
      <span>{ids.length} selected{ids.length === 1 ? ' — pick at least one more' : ''}</span>
      <div className="row gap">
        {ids.length > 1 && <Link to="/compare" className="btn small">Compare now</Link>}
        <button className="btn ghost small" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
