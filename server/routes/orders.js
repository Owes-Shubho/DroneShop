import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();
const round = (n) => Math.round(n * 100) / 100;

// Prices are recomputed server-side from the database; client totals are never trusted.
router.post('/', protect, async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('No order items');
    }

    const products = await Product.find({ _id: { $in: items.map((i) => i.product) } });
    const orderItems = items.map((i) => {
      const p = products.find((x) => x._id.equals(i.product));
      const qty = Number(i.qty);
      if (!p || !Number.isInteger(qty) || qty < 1) {
        res.status(400);
        throw new Error('Invalid item in order');
      }
      if (p.countInStock < qty) {
        res.status(400);
        throw new Error(`Not enough stock for ${p.name}`);
      }
      return { product: p._id, name: p.name, image: p.image, price: p.price, qty };
    });

    // Atomically decrement stock; roll back already-decremented items if one fails.
    const done = [];
    for (const it of orderItems) {
      const r = await Product.updateOne(
        { _id: it.product, countInStock: { $gte: it.qty } },
        { $inc: { countInStock: -it.qty } }
      );
      if (!r.modifiedCount) {
        for (const d of done) await Product.updateOne({ _id: d.product }, { $inc: { countInStock: d.qty } });
        res.status(400);
        throw new Error(`Not enough stock for ${it.name}`);
      }
      done.push(it);
    }

    const itemsPrice = round(orderItems.reduce((s, i) => s + i.price * i.qty, 0));
    const shippingPrice = itemsPrice > 500 ? 0 : 15;
    const taxPrice = round(itemsPrice * 0.08);
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice: round(itemsPrice + shippingPrice + taxPrice),
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/mine', protect, async (req, res, next) => {
  try {
    res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get('/', protect, admin, async (req, res, next) => {
  try {
    res.json(await Order.find().populate('user', 'name email').sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order || (!req.user.isAdmin && !order.user._id.equals(req.user._id))) {
      res.status(404);
      throw new Error('Order not found');
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', protect, admin, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    order.status = req.body.status;
    if (order.status === 'Delivered' && !order.isPaid) {
      order.isPaid = true;
      order.paidAt = new Date();
    }
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
