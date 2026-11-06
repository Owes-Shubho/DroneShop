import { Router } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect, requires } from '../middleware/auth.js';
import { totals, couponProblem } from '../utils/pricing.js';
import { mail } from '../utils/mailer.js';
import { can } from '../utils/permissions.js';
import { changeStock, record } from '../utils/stock.js';

const router = Router();
// Order of the shop-floor flow. Staff can move an order to any status except out of Cancelled.
const STATUSES = ['Processing', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
const CUSTOMER_CANCELLABLE = ['Processing', 'Confirmed'];
const NOT_YET_SHIPPED = ['Processing', 'Confirmed', 'Packed'];
const ADDRESS_FIELDS = ['fullName', 'address', 'city', 'postalCode', 'country'];
const PAYMENT_METHODS = ['Cash on Delivery', 'Card on Delivery'];

const fail = (res, status, message) => {
  res.status(status);
  return new Error(message);
};

// Orders as shown to a viewer: internal notes are staff-only, and customers do not see which staff member made a change.
function view(order, viewer) {
  const o = order.toObject ? order.toObject() : { ...order };
  if (!can(viewer, 'orders')) {
    delete o.notes;
    o.statusHistory = (o.statusHistory || []).map(({ status, at }) => ({ status, at }));
  }
  return o;
}

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
// Returns movement entries to log once the order exists.
async function claimStock(orderItems, res) {
  const done = [];
  for (const it of orderItems) {
    const moved = await changeStock(it.product, -it.qty);
    if (!moved) {
      await releaseStock(done.map((d) => ({ product: d.product, qty: -d.change })));
      throw fail(res, 400, `Not enough stock for ${it.name}`);
    }
    done.push({ product: it.product, change: -it.qty, ...moved });
  }
  return done;
}
// Puts items back in stock and returns movement entries (not logged here).
const releaseStock = (items) =>
  Promise.all(items.map(async (it) => ({ product: it.product, change: it.qty, ...(await changeStock(it.product, it.qty)) }))).then((rows) =>
    rows.filter((r) => r.after !== undefined)
  );

const setStatus = (order, status, actor) => {
  order.status = status;
  order.statusHistory.push({ status, at: new Date(), by: actor?._id, byName: actor?.name });
};

async function cancelOrder(order, by, actor) {
  const back = await releaseStock(order.items);
  if (order.coupon?.code) await Coupon.updateOne({ code: order.coupon.code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  setStatus(order, 'Cancelled', actor);
  order.cancelledBy = by;
  await order.save();
  await record(back, { reason: 'cancellation', order: order._id, user: actor, note: `Order ${String(order._id).slice(-8)} cancelled by ${by}` });
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
  let claimed = null;
  let couponClaimed = null;
  try {
    const { shippingAddress, paymentMethod, couponCode } = req.body;
    if (!shippingAddress || ADDRESS_FIELDS.some((k) => typeof shippingAddress[k] !== 'string' || !shippingAddress[k].trim())) {
      throw fail(res, 400, 'A complete shipping address is required');
    }
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) throw fail(res, 400, 'Unsupported payment method');

    const orderItems = await buildItems(req.body.items, res);
    const subtotal = subtotalOf(orderItems);
    const coupon = await findCoupon(couponCode, subtotal, res);

    claimed = await claimStock(orderItems, res);

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
      statusHistory: [{ status: 'Processing', at: new Date(), by: req.user._id, byName: req.user.name }],
      ...totals(subtotal, coupon),
    });
    const entries = claimed;
    claimed = null; // the order exists now: the reservation stays
    await record(entries, { reason: 'sale', order: order._id, user: req.user, note: `Order ${String(order._id).slice(-8)}` });
    mail.orderPlaced(req.user, order);
    res.status(201).json(view(order, req.user));
  } catch (err) {
    // Undo any reservation made before the failure.
    if (claimed) await releaseStock(claimed.map((d) => ({ product: d.product, qty: -d.change }))).catch(() => {});
    if (couponClaimed) await Coupon.updateOne({ _id: couponClaimed }, { $inc: { usedCount: -1 } }).catch(() => {});
    next(err);
  }
});

router.get('/mine', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders.map((o) => view(o, req.user)));
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
    res.json(view(order, req.user));
  } catch (err) {
    next(err);
  }
});

// Customers can cancel their own order until it is packed.
router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.user.equals(req.user._id)) throw fail(res, 404, 'Order not found');
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw fail(res, 400, 'Only orders that have not been packed yet can be cancelled');
    await cancelOrder(order, 'customer', req.user);
    res.json(view(order, req.user));
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
    res.status(201).json(view(order, req.user));
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
    let back = [];
    if (decision === 'refund') {
      back = await releaseStock(order.items);
      order.isRefunded = true;
    }
    rr.status = { approve: 'Approved', reject: 'Rejected', refund: 'Refunded' }[decision];
    rr.resolvedAt = new Date();
    if (typeof req.body.note === 'string') rr.note = req.body.note.trim().slice(0, 500);
    await order.save();
    await record(back, { reason: 'refund', order: order._id, user: req.user, note: `Order ${String(order._id).slice(-8)} refunded` });
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
      await cancelOrder(order, 'admin', req.user);
      return res.json(order);
    }
    setStatus(order, status, req.user);
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

// Saves carrier and tracking number; an order that has not shipped yet is marked as shipped and the customer is emailed.
router.put('/:id/tracking', protect, requires('orders'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(res, 404, 'Order not found');
    if (order.status === 'Cancelled') throw fail(res, 400, 'A cancelled order cannot be shipped');
    const { carrier = '', number = '', url = '' } = req.body;
    if (!String(number).trim()) throw fail(res, 400, 'A tracking number is required');
    if (url && !/^https?:\/\//i.test(url)) throw fail(res, 400, 'Tracking URL must start with http:// or https://');
    order.tracking = { carrier: String(carrier).trim(), number: String(number).trim(), url: String(url).trim() };
    const becameShipped = NOT_YET_SHIPPED.includes(order.status);
    if (becameShipped) {
      setStatus(order, 'Shipped', req.user);
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

// Internal notes: visible to staff only, never edited or removed.
router.post('/:id/notes', protect, requires('orders'), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(res, 404, 'Order not found');
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 1000) throw fail(res, 400, 'Write a note of up to 1000 characters');
    if (order.notes.length >= 100) throw fail(res, 400, 'This order has reached the limit of 100 notes');
    order.notes.push({ text, by: req.user._id, byName: req.user.name, at: new Date() });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
