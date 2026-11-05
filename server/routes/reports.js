import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { csv, sendCsv } from '../utils/csvOut.js';

// Mounted at /api/admin/reports (permission "reports" is checked by the parent router).
//   GET /:type?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|week|month[&format=csv]
// Revenue counts orders that are not cancelled and not refunded; refunds and cancellations are reported separately.
const router = Router();

const LOW_STOCK = 5;
const MAX_DAYS = 731;
const DAY = 86400000;
const GROUPS = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const counted = { $and: [{ $ne: ['$status', 'Cancelled'] }, { $ne: ['$isRefunded', true] }] };
const sumIf = (cond, value) => ({ $sum: { $cond: [cond, value, 0] } });
const ymd = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');

function fail(res, message) {
  res.status(400);
  return new Error(message);
}

// Parses ?from & ?to (local dates, inclusive). Defaults to the last 30 days.
function range(query, res) {
  const parse = (s, end) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw fail(res, 'Dates must look like 2026-01-31');
    const d = new Date(`${s}T${end ? '23:59:59.999' : '00:00:00'}`);
    if (Number.isNaN(d.getTime()) || ymd(d) !== s) throw fail(res, `"${s}" is not a real date`);
    return d;
  };
  const today = new Date();
  const to = query.to ? parse(query.to, true) : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const from = query.from ? parse(query.from, false) : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 29);
  if (from > to) throw fail(res, 'The start date must be on or before the end date');
  if ((to - from) / DAY > MAX_DAYS) throw fail(res, 'Pick a range of two years or less');
  return { from, to };
}

const col = (key, label, type = 'text') => ({ key, label, type });
const inRange = ({ from, to }) => ({ createdAt: { $gte: from, $lte: to } });

// ---------- report builders: each returns { title, columns, rows, summary, chart? } ----------

async function sales({ from, to }, group) {
  const fmt = GROUPS[group];
  const rows = await Order.aggregate([
    { $match: inRange({ from, to }) },
    {
      $group: {
        _id: { $dateToString: { format: fmt, date: '$createdAt' } },
        orders: sumIf(counted, 1),
        units: sumIf(counted, { $sum: '$items.qty' }),
        gross: sumIf(counted, '$itemsPrice'),
        discounts: sumIf(counted, { $ifNull: ['$discountPrice', 0] }),
        shipping: sumIf(counted, '$shippingPrice'),
        tax: sumIf(counted, '$taxPrice'),
        revenue: sumIf(counted, '$totalPrice'),
        cancelled: sumIf({ $eq: ['$status', 'Cancelled'] }, 1),
        refunded: sumIf({ $eq: ['$isRefunded', true] }, 1),
        refundAmount: sumIf({ $eq: ['$isRefunded', true] }, '$totalPrice'),
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byPeriod = Object.fromEntries(rows.map((r) => [r._id, r]));
  const empty = { orders: 0, units: 0, gross: 0, discounts: 0, shipping: 0, tax: 0, revenue: 0, cancelled: 0, refunded: 0, refundAmount: 0 };
  // Daily reports list every day, including days with no sales, so charts are honest.
  let periods = rows.map((r) => r._id);
  if (group === 'day') {
    periods = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) periods.push(ymd(d));
  }
  const data = periods.map((p) => {
    const r = { ...empty, ...(byPeriod[p] || {}) };
    return { period: p, orders: r.orders, units: r.units, gross: r2(r.gross), discounts: r2(r.discounts), shipping: r2(r.shipping), tax: r2(r.tax), revenue: r2(r.revenue), cancelled: r.cancelled, refunded: r.refunded, refundAmount: r2(r.refundAmount) };
  });
  const t = data.reduce((a, r) => {
    for (const k of Object.keys(empty)) a[k] = (a[k] || 0) + r[k];
    return a;
  }, {});
  const newCustomers = await User.countDocuments(inRange({ from, to }));
  return {
    title: 'Sales',
    columns: [
      col('period', group === 'day' ? 'Date' : group === 'week' ? 'Week' : 'Month'), col('orders', 'Orders', 'int'), col('units', 'Units', 'int'),
      col('gross', 'Gross sales', 'money'), col('discounts', 'Discounts', 'money'), col('shipping', 'Shipping', 'money'), col('tax', 'Tax', 'money'),
      col('revenue', 'Revenue', 'money'), col('cancelled', 'Cancelled', 'int'), col('refunded', 'Refunded', 'int'), col('refundAmount', 'Refund amount', 'money'),
    ],
    rows: data,
    summary: [
      ['Revenue', r2(t.revenue), 'money'], ['Orders', t.orders || 0, 'int'], ['Average order', t.orders ? r2(t.revenue / t.orders) : 0, 'money'],
      ['Units sold', t.units || 0, 'int'], ['Discounts given', r2(t.discounts), 'money'], ['Refunds', r2(t.refundAmount), 'money'],
      ['Cancelled orders', t.cancelled || 0, 'int'], ['New customers', newCustomers, 'int'],
    ],
    chart: { key: 'revenue', label: 'Revenue', labelKey: 'period' },
  };
}

const lines = (rng) => [
  { $match: { ...inRange(rng), status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
  { $unwind: '$items' },
];

async function products(rng) {
  const data = await Order.aggregate([
    ...lines(rng),
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, sku: { $first: '$items.sku' }, units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 200 },
  ]);
  const rows = data.map((r) => ({ sku: r.sku || '', name: r.name, units: r.units, orders: r.orders, revenue: r2(r.revenue), avg: r.units ? r2(r.revenue / r.units) : 0 }));
  return {
    title: 'Products',
    columns: [col('sku', 'SKU'), col('name', 'Product'), col('units', 'Units sold', 'int'), col('orders', 'Orders', 'int'), col('revenue', 'Revenue', 'money'), col('avg', 'Average price', 'money')],
    rows,
    summary: [['Products sold', rows.length, 'int'], ['Units sold', rows.reduce((s, r) => s + r.units, 0), 'int'], ['Revenue', r2(rows.reduce((s, r) => s + r.revenue, 0)), 'money']],
    chart: { key: 'revenue', label: 'Revenue', labelKey: 'name', top: 10 },
  };
}

async function categories(rng) {
  const data = await Order.aggregate([
    ...lines(rng),
    { $lookup: { from: Product.collection.name, localField: 'items.product', foreignField: '_id', as: 'p' } },
    { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$p.category', 0] }, '(deleted product)'] }, units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
  ]);
  const total = data.reduce((s, r) => s + r.revenue, 0);
  const rows = data.map((r) => ({ category: r._id, units: r.units, orders: r.orders, revenue: r2(r.revenue), share: total ? r2((r.revenue / total) * 100) : 0 }));
  return {
    title: 'Sales by category',
    columns: [col('category', 'Category'), col('units', 'Units sold', 'int'), col('orders', 'Order lines', 'int'), col('revenue', 'Revenue', 'money'), col('share', 'Share of revenue', 'percent')],
    rows,
    summary: [['Categories with sales', rows.length, 'int'], ['Revenue', r2(total), 'money']],
    chart: { key: 'revenue', label: 'Revenue', labelKey: 'category' },
  };
}

async function customers(rng) {
  const data = await Order.aggregate([
    { $match: { ...inRange(rng), status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$totalPrice' }, last: { $max: '$createdAt' } } },
    { $sort: { spent: -1 } },
    { $limit: 100 },
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'u' } },
  ]);
  const rows = data.map((r) => ({
    name: r.u[0]?.name || 'Deleted user', email: r.u[0]?.email || '', orders: r.orders, spent: r2(r.spent),
    average: r.orders ? r2(r.spent / r.orders) : 0, last: r.last.toISOString().slice(0, 10),
  }));
  const [newUsers, total] = await Promise.all([User.countDocuments(inRange(rng)), User.estimatedDocumentCount()]);
  return {
    title: 'Customers',
    columns: [col('name', 'Customer'), col('email', 'Email'), col('orders', 'Orders', 'int'), col('spent', 'Spent', 'money'), col('average', 'Average order', 'money'), col('last', 'Last order', 'date')],
    rows,
    summary: [['Buying customers', rows.length, 'int'], ['New sign-ups', newUsers, 'int'], ['Registered users', total, 'int']],
    chart: { key: 'spent', label: 'Spent', labelKey: 'name', top: 10 },
  };
}

// A snapshot of today's stock; the date range does not apply.
async function inventory() {
  const list = await Product.find().select('sku name brand category price countInStock +costPrice').sort({ countInStock: 1, name: 1 }).lean();
  const rows = list.map((p) => ({
    sku: p.sku || '', name: p.name, brand: p.brand, category: p.category, price: r2(p.price), cost: p.costPrice === undefined ? null : r2(p.costPrice),
    margin: p.costPrice === undefined || !p.price ? null : r2(((p.price - p.costPrice) / p.price) * 100),
    stock: p.countInStock, value: r2(p.price * p.countInStock), costValue: p.costPrice === undefined ? null : r2(p.costPrice * p.countInStock),
    status: p.countInStock === 0 ? 'Out of stock' : p.countInStock <= LOW_STOCK ? 'Low' : 'OK',
  }));
  return {
    title: 'Inventory',
    snapshot: true,
    columns: [col('sku', 'SKU'), col('name', 'Product'), col('brand', 'Brand'), col('category', 'Category'), col('price', 'Price', 'money'), col('cost', 'Cost', 'money'), col('margin', 'Margin', 'percent'), col('stock', 'In stock', 'int'), col('value', 'Stock value (retail)', 'money'), col('costValue', 'Stock value (cost)', 'money'), col('status', 'Status')],
    rows,
    summary: [
      ['Products', rows.length, 'int'], ['Units in stock', rows.reduce((s, r) => s + r.stock, 0), 'int'], ['Stock value', r2(rows.reduce((s, r) => s + r.value, 0)), 'money'],
      ['Stock value at cost', r2(rows.reduce((s, r) => s + (r.costValue || 0), 0)), 'money'], ['Low stock', rows.filter((r) => r.status === 'Low').length, 'int'], ['Out of stock', rows.filter((r) => r.status === 'Out of stock').length, 'int'],
    ],
  };
}

async function coupons(rng) {
  const data = await Order.aggregate([
    { $match: { ...inRange(rng), status: { $ne: 'Cancelled' }, 'coupon.code': { $exists: true, $ne: null } } },
    { $group: { _id: '$coupon.code', uses: { $sum: 1 }, discount: { $sum: { $ifNull: ['$discountPrice', 0] } }, revenue: { $sum: '$totalPrice' } } },
    { $sort: { uses: -1 } },
  ]);
  const rows = data.map((r) => ({ code: r._id, uses: r.uses, discount: r2(r.discount), revenue: r2(r.revenue) }));
  return {
    title: 'Coupons',
    columns: [col('code', 'Coupon'), col('uses', 'Orders', 'int'), col('discount', 'Discount given', 'money'), col('revenue', 'Order revenue', 'money')],
    rows,
    summary: [['Coupons used', rows.length, 'int'], ['Orders with a coupon', rows.reduce((s, r) => s + r.uses, 0), 'int'], ['Discount given', r2(rows.reduce((s, r) => s + r.discount, 0)), 'money']],
    chart: { key: 'discount', label: 'Discount given', labelKey: 'code' },
  };
}

async function returns(rng) {
  const orders = await Order.find({ 'returnRequest.requestedAt': { $gte: rng.from, $lte: rng.to } }).populate('user', 'name email').sort({ 'returnRequest.requestedAt': -1 }).limit(1000);
  const rows = orders.map((o) => ({
    order: String(o._id).slice(-8), customer: o.user?.name || 'Deleted user', requested: o.returnRequest.requestedAt.toISOString().slice(0, 10),
    status: o.returnRequest.status, amount: r2(o.totalPrice), reason: o.returnRequest.reason || '', reply: o.returnRequest.note || '',
  }));
  return {
    title: 'Returns',
    columns: [col('order', 'Order'), col('customer', 'Customer'), col('requested', 'Requested', 'date'), col('status', 'Status'), col('amount', 'Order total', 'money'), col('reason', 'Reason'), col('reply', 'Store reply')],
    rows,
    summary: [
      ['Return requests', rows.length, 'int'], ['Refunded', rows.filter((r) => r.status === 'Refunded').length, 'int'],
      ['Refunded amount', r2(rows.filter((r) => r.status === 'Refunded').reduce((s, r) => s + r.amount, 0)), 'money'], ['Waiting for a decision', rows.filter((r) => r.status === 'Requested').length, 'int'],
    ],
  };
}

const TYPES = { sales, products, categories, customers, inventory, coupons, returns };

router.get('/', (req, res) => {
  res.json(Object.keys(TYPES));
});

router.get('/:type', async (req, res, next) => {
  try {
    const build = TYPES[req.params.type];
    if (!build) {
      res.status(404);
      throw new Error('Unknown report');
    }
    const group = req.query.group || 'day';
    if (!GROUPS[group]) throw fail(res, 'Group by day, week or month');
    const rng = range(req.query, res);
    const report = await build(rng, group);
    const out = { type: req.params.type, ...report, from: ymd(rng.from), to: ymd(rng.to), group, generatedAt: new Date().toISOString() };

    if (req.query.format === 'csv') {
      const fmt = (c, v) => (v === null || v === undefined ? '' : c.type === 'money' || c.type === 'percent' ? r2(v) : v);
      const body = csv(
        out.columns.map((c) => c.label),
        out.rows.map((row) => out.columns.map((c) => fmt(c, row[c.key])))
      );
      const when = out.snapshot ? ymd(new Date()) : `${out.from}_to_${out.to}`;
      return sendCsv(res, `report-${out.type}-${when}.csv`, body);
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

export default router;
