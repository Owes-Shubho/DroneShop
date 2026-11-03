import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { mail } from '../utils/mailer.js';
import { PERMISSIONS, ROLES, ROLE_NAMES, roleOf } from '../utils/permissions.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import Category from '../models/Category.js';
import { parseCsv } from '../utils/csvParse.js';
import { protect, staff, requires } from '../middleware/auth.js';

const router = Router();
router.use(protect, staff);

const LOW_STOCK = 5;

router.get('/stats', requires('dashboard'), async (req, res, next) => {
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

// ----- users -----
const bad = (res, status, message) => {
  res.status(status);
  return new Error(message);
};
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const view = (u) => {
  const o = u.toObject ? u.toObject() : u;
  const { password, resetTokenHash, resetTokenExpires, __v, ...rest } = o;
  return { ...rest, role: roleOf(o), isAdmin: roleOf(o) === 'admin' };
};
const applyRole = (user, role) => {
  user.role = role;
  user.isAdmin = role === 'admin';
};
// Someone other than `id` must stay an active admin, or nobody could manage users any more.
const otherAdmins = (id) => User.countDocuments({ isAdmin: true, disabled: { $ne: true }, _id: { $ne: id } });
const findUser = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw bad(res, 404, 'User not found');
  const user = await User.findById(req.params.id).select('-password');
  if (!user) throw bad(res, 404, 'User not found');
  return user;
};
const notSelf = (req, res, what) => {
  if (req.params.id === String(req.user._id)) throw bad(res, 400, `You cannot ${what} your own account`);
};

router.get('/roles', requires('users.view'), async (req, res, next) => {
  try {
    const counts = await User.aggregate([{ $group: { _id: { $cond: ['$isAdmin', 'admin', { $ifNull: ['$role', 'customer'] }] }, count: { $sum: 1 } } }]);
    const byRole = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json({
      permissions: PERMISSIONS,
      roles: ROLE_NAMES.map((name) => ({ name, ...ROLES[name], users: byRole[name] || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users?q=&role=&status=active|suspended&page=&limit=
router.get('/users', requires('users.view'), async (req, res, next) => {
  try {
    const { q, role, status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = {};
    if (typeof q === 'string' && q.trim()) {
      const re = new RegExp(escapeRe(q.trim().slice(0, 60)), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }
    if (ROLE_NAMES.includes(role)) {
      if (role === 'admin') filter.isAdmin = true;
      else {
        filter.isAdmin = { $ne: true };
        filter.role = role === 'customer' ? { $in: ['customer', null] } : role;
      }
    }
    if (status === 'suspended') filter.disabled = true;
    if (status === 'active') filter.disabled = { $ne: true };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const counts = await Order.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) }, status: { $ne: 'Cancelled' } } },
      { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$totalPrice' } } },
    ]);
    const byUser = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    res.json({
      users: users.map((u) => ({ ...view(u), orders: byUser[u._id]?.orders || 0, spent: byUser[u._id]?.spent || 0 })),
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', requires('users.view'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    const [orders, totals] = await Promise.all([
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).select('totalPrice status createdAt items isRefunded'),
      Order.aggregate([
        { $match: { user: user._id, status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } } },
        { $group: { _id: null, orders: { $sum: 1 }, spent: { $sum: '$totalPrice' } } },
      ]),
    ]);
    res.json({ ...view(user), wishlistCount: user.wishlist.length, orders: totals[0]?.orders || 0, spent: totals[0]?.spent || 0, recentOrders: orders });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requires('users.manage'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'customer' } = req.body;
    if (typeof name !== 'string' || !name.trim() || !isEmail(email) || typeof password !== 'string' || password.length < 6) {
      throw bad(res, 400, 'A name, a valid email and a password of at least 6 characters are required');
    }
    if (!ROLE_NAMES.includes(role)) throw bad(res, 400, 'Unknown role');
    if (await User.findOne({ email: email.trim().toLowerCase() })) throw bad(res, 400, 'Email already registered');
    const user = new User({ name, email, password });
    applyRole(user, role);
    await user.save();
    res.status(201).json(view(user));
  } catch (err) {
    next(err);
  }
});

// Edit name / email, or suspend and reinstate an account.
router.put('/users/:id', requires('users.manage'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    const { name, email, disabled } = req.body;
    if (typeof name === 'string') {
      if (!name.trim()) throw bad(res, 400, 'Name cannot be empty');
      user.name = name.trim();
    }
    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) {
      if (!isEmail(email)) throw bad(res, 400, 'Enter a valid email');
      if (await User.findOne({ email: email.trim().toLowerCase() })) throw bad(res, 400, 'Email already registered');
      user.email = email;
    }
    if (typeof disabled === 'boolean' && disabled !== Boolean(user.disabled)) {
      if (disabled) {
        notSelf(req, res, 'suspend');
        if (user.isAdmin && !(await otherAdmins(user._id))) throw bad(res, 400, 'You cannot suspend the last active admin');
      }
      user.disabled = disabled;
    }
    await user.save();
    res.json(view(user));
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/role', requires('roles'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    const { role } = req.body;
    if (!ROLE_NAMES.includes(role)) throw bad(res, 400, 'Unknown role');
    notSelf(req, res, 'change the role of');
    if (user.isAdmin && role !== 'admin' && !(await otherAdmins(user._id))) throw bad(res, 400, 'You cannot demote the last active admin');
    applyRole(user, role);
    await user.save();
    res.json(view(user));
  } catch (err) {
    next(err);
  }
});

// Older clients toggle admin with a boolean; this maps it onto roles.
router.put('/users/:id/admin', requires('roles'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    notSelf(req, res, 'change the role of');
    const makeAdmin = Boolean(req.body.isAdmin);
    if (user.isAdmin && !makeAdmin && !(await otherAdmins(user._id))) throw bad(res, 400, 'You cannot demote the last active admin');
    applyRole(user, makeAdmin ? 'admin' : 'customer');
    await user.save();
    res.json(view(user));
  } catch (err) {
    next(err);
  }
});

// Sends the user a password-reset link (same single-use, one-hour token as "forgot password").
router.post('/users/:id/reset-password', requires('users.manage'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    mail.passwordReset(user, token);
    res.json({ message: `Reset link sent to ${user.email}` });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requires('users.manage'), async (req, res, next) => {
  try {
    const user = await findUser(req, res);
    notSelf(req, res, 'delete');
    if (user.isAdmin && !(await otherAdmins(user._id))) throw bad(res, 400, 'You cannot delete the last active admin');
    await user.deleteOne();
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

router.get('/coupons', requires('coupons'), async (req, res, next) => {
  try {
    res.json(await Coupon.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post('/coupons', requires('coupons'), async (req, res, next) => {
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

router.put('/coupons/:id', requires('coupons'), async (req, res, next) => {
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

router.delete('/coupons/:id', requires('coupons'), async (req, res, next) => {
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

router.get('/export/orders.csv', requires('orders'), async (req, res, next) => {
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

router.post('/import/products', requires('products'), async (req, res, next) => {
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

router.get('/export/products.csv', requires('products'), async (req, res, next) => {
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
