import { Router } from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Category from '../models/Category.js';
import { parseCsv } from '../utils/csvParse.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();
router.use(protect, admin);

const LOW_STOCK = 5;

router.get('/stats', async (req, res, next) => {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    const [orderCount, productCount, userCount, revenueAgg, byStatus, daily, topAgg, lowStock, recent] =
      await Promise.all([
        Order.countDocuments(),
        Product.countDocuments(),
        User.countDocuments(),
        Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
          { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
        ]),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Order.aggregate([
          { $match: { createdAt: { $gte: since }, status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$totalPrice' },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.product',
              name: { $first: '$items.name' },
              image: { $first: '$items.image' },
              units: { $sum: '$items.qty' },
              revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
            },
          },
          { $sort: { units: -1 } },
          { $limit: 5 },
        ]),
        Product.find({ countInStock: { $lte: LOW_STOCK } })
          .select('name image countInStock')
          .sort({ countInStock: 1 })
          .limit(8),
        Order.find().populate('user', 'name').sort({ createdAt: -1 }).limit(6),
      ]);

    // Fill in days with no sales so the chart always shows 7 bars.
    const dailyMap = Object.fromEntries(daily.map((d) => [d._id, d]));
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      return { date: key, revenue: dailyMap[key]?.revenue || 0, orders: dailyMap[key]?.orders || 0 };
    });

    res.json({
      orderCount,
      productCount,
      userCount,
      revenue: revenueAgg[0]?.revenue || 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      last7,
      topProducts: topAgg,
      lowStock,
      lowStockThreshold: LOW_STOCK,
      recent,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    const counts = await Order.aggregate([
      { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$totalPrice' } } },
    ]);
    const byUser = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    res.json(users.map((u) => ({ ...u, orders: byUser[u._id]?.orders || 0, spent: byUser[u._id]?.spent || 0 })));
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/admin', async (req, res, next) => {
  try {
    if (req.params.id === String(req.user._id)) {
      res.status(400);
      throw new Error('You cannot change your own admin role');
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    user.isAdmin = Boolean(req.body.isAdmin);
    await user.save();
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === String(req.user._id)) {
      res.status(400);
      throw new Error('You cannot delete your own account');
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.json({ message: 'User removed' });
  } catch (err) {
    next(err);
  }
});

// ----- coupons -----
const COUPON_FIELDS = ['code', 'type', 'value', 'minSubtotal', 'expiresAt', 'usageLimit', 'active'];
const couponData = (body) => {
  const d = Object.fromEntries(COUPON_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  // Empty form fields mean "no limit" / "no expiry".
  if (d.expiresAt === '' || d.expiresAt === null) d.expiresAt = undefined;
  if (d.usageLimit === '' || d.usageLimit === null) d.usageLimit = undefined;
  return d;
};

router.get('/coupons', async (req, res, next) => {
  try {
    res.json(await Coupon.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post('/coupons', async (req, res, next) => {
  try {
    res.status(201).json(await Coupon.create(couponData(req.body)));
  } catch (err) {
    if (err.code === 11000) {
      res.status(400);
      err = new Error('A coupon with that code already exists');
    }
    next(err);
  }
});

router.put('/coupons/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      res.status(404);
      throw new Error('Coupon not found');
    }
    coupon.set(couponData(req.body));
    if (req.body.expiresAt === '' || req.body.expiresAt === null) coupon.expiresAt = undefined;
    if (req.body.usageLimit === '' || req.body.usageLimit === null) coupon.usageLimit = undefined;
    await coupon.save();
    res.json(coupon);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400);
      err = new Error('A coupon with that code already exists');
    }
    next(err);
  }
});

router.delete('/coupons/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      res.status(404);
      throw new Error('Coupon not found');
    }
    res.json({ message: 'Coupon removed' });
  } catch (err) {
    next(err);
  }
});

// ----- CSV export -----
// Cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas.
const cell = (v) => {
  let t = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
const sendCsv = (res, name, body) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('\uFEFF' + body); // BOM so Excel reads UTF-8
};

router.get('/export/orders.csv', async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    sendCsv(res, 'orders.csv', csv(
      ['Order', 'Date', 'Customer', 'Email', 'Status', 'Paid', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total', 'Coupon', 'Tracking'],
      orders.map((o) => [
        o._id, o.createdAt.toISOString(), o.user?.name, o.user?.email, o.status, o.isPaid ? 'yes' : 'no',
        o.items.map((i) => `${i.qty}x ${i.name}`).join('; '), o.itemsPrice, o.discountPrice || 0, o.shippingPrice, o.taxPrice, o.totalPrice,
        o.coupon?.code, o.tracking?.number,
      ])
    ));
  } catch (err) {
    next(err);
  }
});

// ----- CSV import -----
// Columns (header row required): name, brand, category, price, stock, description; optional: image.
// A row whose name + brand already exists updates that product's price, stock, category, description and image.
const MAX_IMPORT_ROWS = 500;

router.post('/import/products', async (req, res, next) => {
  try {
    if (typeof req.body.csv !== 'string' || !req.body.csv.trim()) {
      res.status(400);
      throw new Error('Choose a CSV file to import');
    }
    const [head, ...rows] = parseCsv(req.body.csv);
    const cols = head.map((h) => h.trim().toLowerCase());
    const missing = ['name', 'brand', 'category', 'price', 'stock', 'description'].filter((c) => !cols.includes(c));
    if (missing.length) {
      res.status(400);
      throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      res.status(400);
      throw new Error(`Import up to ${MAX_IMPORT_ROWS} rows at a time`);
    }

    const known = new Set((await Category.find().select('name')).map((c) => c.name));
    const result = { created: 0, updated: 0, errors: [] };
    for (const [n, r] of rows.entries()) {
      const row = Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()]));
      const line = n + 2; // header is line 1
      const price = Number(row.price);
      const stock = Number(row.stock);
      const problem =
        !row.name || !row.brand || !row.description ? 'name, brand and description are required'
        : !known.has(row.category) ? `unknown category "${row.category}"`
        : !(price >= 0) || row.price === '' ? 'price must be a number, 0 or more'
        : !Number.isInteger(stock) || stock < 0 || row.stock === '' ? 'stock must be a whole number, 0 or more'
        : row.image && !/^(https?:\/\/|\/)/i.test(row.image) ? 'image must be a URL or a path starting with /'
        : '';
      if (problem) {
        result.errors.push({ line, message: problem });
        continue;
      }
      const data = { category: row.category, price, countInStock: stock, description: row.description, ...(row.image ? { image: row.image } : {}) };
      const existing = await Product.findOne({ name: row.name, brand: row.brand });
      if (existing) {
        existing.set(data);
        await existing.save();
        result.updated++;
      } else {
        await Product.create({ name: row.name, brand: row.brand, ...data });
        result.created++;
      }
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/export/products.csv', async (req, res, next) => {
  try {
    const products = await Product.find().select('-reviews').sort({ name: 1 });
    sendCsv(res, 'products.csv', csv(
      ['ID', 'Name', 'Brand', 'Category', 'Price', 'Stock', 'Rating', 'Reviews'],
      products.map((p) => [p._id, p.name, p.brand, p.category, p.price, p.countInStock, p.rating.toFixed(1), p.numReviews])
    ));
  } catch (err) {
    next(err);
  }
});

export default router;
