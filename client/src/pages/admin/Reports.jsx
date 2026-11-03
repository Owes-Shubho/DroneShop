import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, money, download } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader, ErrorMsg } from '../../components/Bits.jsx';
import useTitle from '../../useTitle.js';

const TABS = [
  ['sales', 'Sales'], ['products', 'Products'], ['categories', 'Categories'], ['customers', 'Customers'],
  ['inventory', 'Inventory'], ['coupons', 'Coupons'], ['returns', 'Returns'],
];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const PRESETS = [
  ['Last 7 days', () => [ymd(daysAgo(6)), ymd(new Date())]],
  ['Last 30 days', () => [ymd(daysAgo(29)), ymd(new Date())]],
  ['Last 90 days', () => [ymd(daysAgo(89)), ymd(new Date())]],
  ['This month', () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)]; }],
  ['Last month', () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))]; }],
  ['This year', () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), 0, 1)), ymd(n)]; }],
];

const fmt = (type, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (type === 'money') return money(v);
  if (type === 'int') return Number(v).toLocaleString();
  if (type === 'percent') return `${v}%`;
  return v;
};

function Chart({ report }) {
  const { chart, rows } = report;
  const data = (chart.top ? rows.slice(0, chart.top) : rows).map((r) => ({ label: r[chart.labelKey], value: r[chart.key] }));
  const max = Math.max(...data.map((d) => d.value), 1);
  const isMoney = report.columns.find((c) => c.key === chart.key)?.type === 'money';
  if (data.length === 0 || data.every((d) => !d.value)) return <p className="muted">Nothing to chart for this range.</p>;

  // Time series: vertical bars. Ranked lists: horizontal bars with the name beside each one.
  if (report.type === 'sales') {
    const every = Math.ceil(data.length / 12);
    return (
      <div className="bars tall" role="img" aria-label={`${chart.label} by ${report.group}`}>
        {data.map((d, i) => (
          <div key={d.label} className="bar-col" title={`${d.label}: ${fmt(isMoney ? 'money' : 'int', d.value)}`}>
            <div className="bar" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 3 : 0.5)}%` }} />
            <small>{i % every === 0 ? String(d.label).slice(report.group === 'day' ? 5 : 0) : ''}</small>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="hbars" role="img" aria-label={`${chart.label} by ${chart.labelKey}`}>
      {data.map((d) => (
        <div key={d.label} className="hbar-row">
          <span className="hbar-label" title={d.label}>{d.label}</span>
          <div className="hbar-track"><div className="hbar" style={{ width: `${Math.max((d.value / max) * 100, d.value ? 2 : 0)}%` }} /></div>
          <strong>{fmt(isMoney ? 'money' : 'int', d.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  useTitle('Reports');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const type = TABS.some(([t]) => t === params.get('type')) ? params.get('type') : 'sales';
  const [def0, def1] = useMemo(() => PRESETS[1][1](), []);
  const from = params.get('from') || def0;
  const to = params.get('to') || def1;
  const group = params.get('group') || 'day';
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const query = `from=${from}&to=${to}&group=${group}`;
  useEffect(() => {
    let live = true;
    setReport(null);
    setError('');
    api(`/admin/reports/${type}?${query}`, { token: user.token })
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [type, query]);

  const exportCsv = async () => {
    setBusy(true);
    setError('');
    try {
      await download(`/admin/reports/${type}?${query}&format=csv`, `report-${type}-${report?.snapshot ? ymd(new Date()) : `${from}_to_${to}`}.csv`, user.token);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const snapshot = type === 'inventory';
  const active = PRESETS.find(([, fn]) => { const [f, t] = fn(); return f === from && t === to; })?.[0];

  return (
    <>
      <div className="row between wrap gap">
        <h1>Reports</h1>
        <div className="row gap no-print">
          <button className="btn ghost" onClick={() => window.print()} disabled={!report}>Print / save as PDF</button>
          <button className="btn" onClick={exportCsv} disabled={!report || busy}>{busy ? 'Exporting…' : 'Export CSV'}</button>
        </div>
      </div>

      <div className="tabs no-print" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={t === type} className={t === type ? 'on' : ''} onClick={() => set({ type: t === 'sales' ? '' : t })}>{label}</button>
        ))}
      </div>

      {!snapshot && (
        <div className="toolbar no-print">
          <select value={active || ''} onChange={(e) => { const p = PRESETS.find(([l]) => l === e.target.value); if (p) { const [f, t] = p[1](); set({ from: f, to: t }); } }} aria-label="Date range">
            <option value="">Custom range</option>
            {PRESETS.map(([l]) => <option key={l}>{l}</option>)}
          </select>
          <label className="inline">From <input type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} /></label>
          <label className="inline">To <input type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} /></label>
          {type === 'sales' && (
            <select value={group} onChange={(e) => set({ group: e.target.value === 'day' ? '' : e.target.value })} aria-label="Group by">
              <option value="day">By day</option><option value="week">By week</option><option value="month">By month</option>
            </select>
          )}
        </div>
      )}

      <ErrorMsg error={error} />
      {!report && !error && <Loader />}
      {report && (
        <div className="report">
          <p className="muted">
            {report.title} — {snapshot ? `stock as of ${new Date(report.generatedAt).toLocaleString()}` : `${report.from} to ${report.to}`}.
            {' '}Revenue excludes cancelled and refunded orders.
          </p>
          <div className="kpis">
            {report.summary.map(([label, value, t]) => (
              <div key={label} className="kpi"><span>{label}</span><strong>{fmt(t, value)}</strong></div>
            ))}
          </div>
          {report.chart && <div className="panel"><h3>{report.chart.label}</h3><Chart report={report} /></div>}
          <div className="compare-scroll">
            <table className="table">
              <thead><tr>{report.columns.map((c) => <th key={c.key} className={['money', 'int', 'percent'].includes(c.type) ? 'num' : ''}>{c.label}</th>)}</tr></thead>
              <tbody>
                {report.rows.length === 0 && <tr><td colSpan={report.columns.length} className="muted">No data for this range.</td></tr>}
                {report.rows.map((row, i) => (
                  <tr key={i}>
                    {report.columns.map((c) => <td key={c.key} className={['money', 'int', 'percent'].includes(c.type) ? 'num' : ''}>{fmt(c.type, row[c.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{report.rows.length} row{report.rows.length === 1 ? '' : 's'}. Export CSV downloads the same data for a spreadsheet.</p>
        </div>
      )}
    </>
  );
}
