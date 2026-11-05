import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, requires } from '../middleware/auth.js';
import { totals, couponProblem } from '../utils/pricing.js';
import { mail } from '../utils/mailer.js';
import { can } from '../utils/permissions.js';

const router = Router();
const STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
const ADDRESS_FIELDS = ['fullName', 'address', 'city', 'postalCode', 'country'];
const PAYMENT_METHODS = ['Cash on Delivery', 'Card on Delivery'];

const fail = (res, status, message) => {
  res.status(status);
  return new Error(message);
};

/** Validates the cart against the database and returns trusted line items (price and name come from the DB). */
async function buildItems(items, res) {
  if (!Array.isArray(items) || items.length === 0) throw fail(res, 400, 'No order items');
  if (items.length > 50) throw fail(res, 400, 'Too many items in one order');
  const ids = items.map((i) => i?.product);
  if (new Set(ids.map(String)).size !== ids.length) throw fail(res, 400, 'Duplicate items in order');
  const products = await Product.find({ _id: { $in: ids } });
  return items.map((i) => {
    const p = products.find((x) => String(x._id) === String(i.product));
    const qty = Number(i.qty);
    if (!p || !Number.isInteger(qty) || qty < 1) throw fail(res, 400, 'Invalid item in order');
    if (p.countInStock < qty) throw fail(res, 400, `Not enough stock for ${p.name}`);
    return { product: p._id, name: p.name, sku: p.sku, image: p.image, price: p.price, qty };
  });
}

async function findCoupon(code, subtotal, res) {
  if (!code) return null;
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  const problem = couponProblem(coupon, subtotal);
  if (problem) throw fail(res, 400, problem);
  return coupon;
}

const subtotalOf = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

// Atomically decrement stock; undo the ones already taken if a later one fails.
async function claimStock(orderItems, res) {
  const done = [];
  for (const it of orderItems) {
    const r = await Product.updateOne({ _id: it.product, countInStock: { $gte: it.qty } }, { $inc: { countInStock: -it.qty } });
    if (!r.modifiedCount) {
      await releaseStock(done);
      throw fail(res, 400, `Not enough stock for ${it.name}`);
    }
    done.push(it);
  }
}
const releaseStock = (items) =>
  Promise.all(items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { countInStock: it.qty } })));

async function cancelOrder(order, by) {
  await releaseStock(order.items);
  if (order.coupon?.code) await Coupon.updateOne({ code: order.coupon.code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  order.status = 'Cancelled';
  order.cancelledBy = by;
  await order.save();
  const user = await User.findById(order.user);
  if (user) mail.orderCancelled(user, order);
}

// Price preview used by the checkout page; the same rules apply when the order is created.
router.post('/quote', protect, async (req, res, next) => {
  try {
    const items = await buildItems(req.body.items, res);
    const subtotal = subtotalOf(items);
    const coupon = await findCoupon(req.body.couponCode, subtotal, res);
    res.json({
      ...totals(subtotal, coupon),
      coupon: coupon && { code: coupon.code, type: coupon.type, value: coupon.value },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  let claimed = false;
  let couponClaimed = null;
  let orderItems;
  try {
    const { shippingAddress, paymentMethod, couponCode } = req.body;
    if (!shippingAddress || ADDRESS_FIELDS.some((k) => typeof shippingAddress[k] !== 'string' || !shippingAddress[k].trim())) {
      throw fail(res, 400, 'A complete shipping address is required');
    }
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) throw fail(res, 400, 'Unsupported payment method');

    orderItems = await buildItems(req.body.items, res);
    const subtotal = subtotalOf(orderItems);
    const coupon = await findCoupon(couponCode, subtotal, res);

    await claimStock(orderItems, res);
    claimed = true;

    if (coupon) {
      const filter = { _id: coupon._id, active: true, ...(coupon.usageLimit ? { usedCount: { $lt: coupon.usageLimit } } : {}) };
      const r = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
      if (!r.modifiedCount) throw fail(res, 400, 'This coupon has been fully redeemed');
      couponClaimed = coupon._id;
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress: Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, shippingAddress[k].trim()])),
      paymentMethod: paymentMethod || 'Cash on Delivery',
      coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : undefined,
      ...totals(subtotal, coupon),
    });
    mail.orderPlaced(req.user, order);
    res.status(201).json(order);
  } catch (err) {
    // Undo any reservation made before the failure.
    if (claimed) await releaseStock(orderItems).catch(() => {});
    if (couponClaimed) await Coupon.updateOne({ _id: couponClaimed }, { $inc: { usedCount: -1 } }).catch(() => {});
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

router.get('/', protect, requires('orders'), async (req, res, next) => {
  try {
    res.json(await Order.find().populate('user', 'name email').sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order || (!can(req.user, 'orders') && !order.user?._id.equals(req.user._id))) throw fail(res, 404, 'Order not found');
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Customers can cancel their own order until it ships.
router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.user.equals(req.user._id)) throw fail(res, 404, 'Order not found');
    if (order.status !== 'Processing') throw fail(res, 400, 'Only orders that are still processing can be cancelled');
    await cancelOrder(order, 'customer');
    res.json(order);
  } catch (err) {
    next(err);
  }
});

const RETURN_WINDOW_DAYS = 30;

// Customer asks to return a delivered order (within 30 days of delivery).
router.post('/:id/return', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.user.equals(req.user._id)) throw fail(res, 404, 'Order not found');
    if (order.status !== 'Delivered') throw fail(res, 400, 'Only delivered orders can be returned');
    if (order.returnRequest?.status) throw fail(res, 400, 'A return was already requested for this order');
    const since = order.deliveredAt || order.updatedAt;
    if (Date.now() - since.getTime() > RETURN_WINDOW_DAYS * 86400000) throw fail(res, 400, `The ${RETURN_WINDOW_DAYS}-day return window has passed`);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 500) throw fail(res, 400, 'Tell us why you are returning it (5–500 characters)');
    order.returnRequest = { reason, status: 'Requested', requestedAt: new Date() };
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// Admin decision: approve, reject, or refund (refund puts the items back in stock).
router.put('/:id/return', protect, requires('orders'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(res, 404, 'Order not found');
    const rr = order.returnRequest;
    if (!rr?.status) throw fail(res, 400, 'No return was requested for this order');
    const { decision } = req.body;
    const allowed = { Requested: ['approve', 'reject', 'refund'], Approved: ['refund'] }[rr.status] || [];
    if (!allowed.includes(decision)) throw fail(res, 400, `A ${rr.status.toLowerCase()} return cannot be ${decision}d`);
    if (decision === 'refund') {
      await releaseStock(order.items);
      order.isRefunded = true;
    }
    rr.status = { approve: 'Approved', reject: 'Rejected', refund: 'Refunded' }[decision];
    rr.resolvedAt = new Date();
    if (typeof req.body.note === 'string') rr.note = req.body.note.trim().slice(0, 500);
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/status', protect, requires('orders'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(res, 404, 'Order not found');
    const status = req.body.status;
    if (!STATUSES.includes(status)) throw fail(res, 400, 'Invalid status');
    if (order.status === 'Cancelled' && status !== 'Cancelled') throw fail(res, 400, 'A cancelled order cannot be reopened');
    if (status === order.status) return res.json(order);

    if (status === 'Cancelled') {
      await cancelOrder(order, 'admin');
      return res.json(order);
    }
    order.status = status;
    if (status === 'Shipped') order.shippedAt = new Date();
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      if (!order.isPaid) {
        order.isPaid = true;
        order.paidAt = new Date();
      }
    }
    await order.save();
    if (status === 'Shipped') {
      const user = await User.findById(order.user);
      if (user) mail.orderShipped(user, order);
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Saves carrier and tracking number; a processing order is marked as shipped and the customer is emailed.
router.put('/:id/tracking', protect, requires('orders'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(res, 404, 'Order not found');
    if (order.status === 'Cancelled') throw fail(res, 400, 'A cancelled order cannot be shipped');
    const { carrier = '', number = '', url = '' } = req.body;
    if (!String(number).trim()) throw fail(res, 400, 'A tracking number is required');
    if (url && !/^https?:\/\//i.test(url)) throw fail(res, 400, 'Tracking URL must start with http:// or https://');
    order.tracking = { carrier: String(carrier).trim(), number: String(number).trim(), url: String(url).trim() };
    const becameShipped = order.status === 'Processing';
    if (becameShipped) {
      order.status = 'Shipped';
      order.shippedAt = new Date();
    }
    await order.save();
    if (becameShipped) {
      const user = await User.findById(order.user);
      if (user) mail.orderShipped(user, order);
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
