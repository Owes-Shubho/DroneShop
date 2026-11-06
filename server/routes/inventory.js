import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockMovement, { MOVEMENT_REASONS } from '../models/StockMovement.js';
import Supplier from '../models/Supplier.js';
import { changeStock, record } from '../utils/stock.js';
import { csv, sendCsv } from '../utils/csvOut.js';

// Mounted at /api/admin/inventory (permission "inventory" is checked by the parent router).
const router = Router();

const LOW_STOCK = 5;
const MANUAL_REASONS = ['purchase', 'damaged', 'correction', 'supplier-return'];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (res, status, message) => {
  res.status(status);
  return new Error(message);
};
const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));

// ---------- stock list ----------
// GET /stock?q=&filter=low|out&category=&page=&limit=
router.get('/stock', async (req, res, next) => {
  try {
    const { q, filter, category } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const find = {};
    if (typeof q === 'string' && q.trim()) {
      const re = new RegExp(escapeRe(q.trim().slice(0, 60)), 'i');
      find.$or = [{ name: re }, { sku: re }, { brand: re }];
    }
    if (typeof category === 'string' && category) find.category = category;
    if (filter === 'out') find.countInStock = 0;
    if (filter === 'low') find.countInStock = { $gt: 0, $lte: LOW_STOCK };

    const [total, products, agg] = await Promise.all([
      Product.countDocuments(find),
      Product.find(find).select('name sku brand category image countInStock price').sort({ countInStock: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.aggregate([{ $group: { _id: null, units: { $sum: '$countInStock' }, low: { $sum: { $cond: [{ $and: [{ $gt: ['$countInStock', 0] }, { $lte: ['$countInStock', LOW_STOCK] }] }, 1, 0] } }, out: { $sum: { $cond: [{ $eq: ['$countInStock', 0] }, 1, 0] } }, products: { $sum: 1 } } }]),
    ]);
    const s = agg[0] || { units: 0, low: 0, out: 0, products: 0 };
    res.json({
      products: products.map((p) => ({ ...p, status: p.countInStock === 0 ? 'Out of stock' : p.countInStock <= LOW_STOCK ? 'Low' : 'OK' })),
      page, pages: Math.ceil(total / limit), total,
      summary: { products: s.products, units: s.units, low: s.low, out: s.out, lowThreshold: LOW_STOCK },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- adjust ----------
// Body: { product, reason: purchase|damaged|correction|supplier-return, change (signed whole number), note, supplier, unitCost }
router.post('/adjust', async (req, res, next) => {
  try {
    const { product, reason, supplier } = req.body;
    const change = Number(req.body.change);
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
    if (!mongoose.isValidObjectId(product)) throw fail(res, 400, 'Choose a product');
    if (!MANUAL_REASONS.includes(reason)) throw fail(res, 400, `Reason must be one of: ${MANUAL_REASONS.join(', ')}`);
    if (!Number.isInteger(change) || change === 0) throw fail(res, 400, 'Change must be a whole number other than 0');
    if (reason === 'purchase' && change < 0) throw fail(res, 400, 'A purchase adds stock');
    if ((reason === 'damaged' || reason === 'supplier-return') && change > 0) throw fail(res, 400, `${reason === 'damaged' ? 'Damaged stock' : 'A supplier return'} removes stock`);
    if ((reason === 'damaged' || reason === 'correction') && note.length < 3) throw fail(res, 400, 'Add a short note explaining the change');
    if (Math.abs(change) > 100000) throw fail(res, 400, 'That quantity is too large');

    const unitCost = num(req.body.unitCost);
    if (unitCost !== undefined && !(unitCost >= 0)) throw fail(res, 400, 'Unit cost must be a number, 0 or more');
    let supplierDoc;
    if (supplier) {
      supplierDoc = mongoose.isValidObjectId(supplier) ? await Supplier.findById(supplier) : null;
      if (!supplierDoc) throw fail(res, 400, 'Unknown supplier');
    }

    const moved = await changeStock(product, change);
    if (!moved) {
      const exists = await Product.exists({ _id: product });
      throw fail(res, exists ? 400 : 404, exists ? 'Not enough stock to remove that many' : 'Product not found');
    }
    await record([{ product, change, ...moved }], {
      reason, note, user: req.user,
      supplier: reason === 'purchase' || reason === 'supplier-return' ? supplierDoc?._id : undefined,
      unitCost: reason === 'purchase' ? unitCost : undefined,
    });
    res.json({ product, sku: moved.sku, name: moved.name, change, after: moved.after });
  } catch (err) {
    next(err);
  }
});

// ---------- movement log ----------
// GET /movements?product=&reason=&q=&from=&to=&page=&limit=[&format=csv]
router.get('/movements', async (req, res, next) => {
  try {
    const { product, reason, q, from, to } = req.query;
    const find = {};
    if (product) {
      if (!mongoose.isValidObjectId(product)) throw fail(res, 400, 'Unknown product');
      find.product = product;
    }
    if (reason) {
      if (!MOVEMENT_REASONS.includes(reason)) throw fail(res, 400, 'Unknown reason');
      find.reason = reason;
    }
    if (typeof q === 'string' && q.trim()) {
      const re = new RegExp(escapeRe(q.trim().slice(0, 60)), 'i');
      find.$or = [{ name: re }, { sku: re }];
    }
    const day = (s, end) => {
      const d = new Date(`${s}T${end ? '23:59:59.999' : '00:00:00'}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime())) throw fail(res, 400, 'Dates must look like 2026-01-31');
      return d;
    };
    if (from || to) {
      find.createdAt = {};
      if (from) find.createdAt.$gte = day(from, false);
      if (to) find.createdAt.$lte = day(to, true);
    }

    if (req.query.format === 'csv') {
      const rows = await StockMovement.find(find).populate('supplier', 'name').sort({ createdAt: -1 }).limit(5000).lean();
      return sendCsv(res, 'stock-movements.csv', csv(
        ['Date', 'SKU', 'Product', 'Change', 'Stock after', 'Reason', 'Note', 'By', 'Order', 'Supplier', 'Unit cost'],
        rows.map((m) => [m.createdAt.toISOString(), m.sku, m.name, m.change, m.after, m.reason, m.note, m.userName, m.order, m.supplier?.name, m.unitCost])
      ));
    }
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const [total, movements] = await Promise.all([
      StockMovement.countDocuments(find),
      StockMovement.find(find).populate('supplier', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.json({ movements, page, pages: Math.ceil(total / limit), total, reasons: MOVEMENT_REASONS });
  } catch (err) {
    next(err);
  }
});

// ---------- suppliers ----------
function supplierData(body, res) {
  const text = (k, max) => (typeof body[k] === 'string' ? body[k].trim().slice(0, max) : '');
  const name = text('name', 80);
  if (!name) throw fail(res, 400, 'Supplier name is required');
  const email = text('email', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(res, 400, 'Enter a valid email');
  return {
    name, email, contactName: text('contactName', 80), phone: text('phone', 40), address: text('address', 300), notes: text('notes', 500),
    ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
  };
}
const dupName = (err, res) => (err.code === 11000 ? fail(res, 400, 'A supplier with that name already exists') : err);

router.get('/suppliers', async (req, res, next) => {
  try {
    const [list, counts] = await Promise.all([
      Supplier.find().sort({ name: 1 }).collation({ locale: 'en' }).lean(),
      StockMovement.aggregate([{ $match: { supplier: { $ne: null }, reason: 'purchase' } }, { $group: { _id: '$supplier', purchases: { $sum: 1 }, units: { $sum: '$change' }, last: { $max: '$createdAt' } } }]),
    ]);
    const by = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    res.json(list.map((s) => ({ ...s, purchases: by[s._id]?.purchases || 0, unitsReceived: by[s._id]?.units || 0, lastPurchase: by[s._id]?.last || null })));
  } catch (err) {
    next(err);
  }
});

router.post('/suppliers', async (req, res, next) => {
  try {
    res.status(201).json(await Supplier.create(supplierData(req.body, res)));
  } catch (err) {
    next(dupName(err, res));
  }
});

router.put('/suppliers/:id', async (req, res, next) => {
  try {
    const s = mongoose.isValidObjectId(req.params.id) ? await Supplier.findById(req.params.id) : null;
    if (!s) throw fail(res, 404, 'Supplier not found');
    s.set(supplierData({ ...s.toObject(), ...req.body }, res)); // fields not sent keep their value
    await s.save();
    res.json(s);
  } catch (err) {
    next(dupName(err, res));
  }
});

router.delete('/suppliers/:id', async (req, res, next) => {
  try {
    const s = mongoose.isValidObjectId(req.params.id) ? await Supplier.findById(req.params.id) : null;
    if (!s) throw fail(res, 404, 'Supplier not found');
    if (await StockMovement.exists({ supplier: s._id })) throw fail(res, 400, 'This supplier appears in the stock log. Mark it inactive instead of deleting it.');
    await s.deleteOne();
    res.json({ message: 'Supplier removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
