// Integration tests. They run against a separate database (name must end in "_test") and wipe it first.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: Product } = await import('../models/Product.js');
const { default: Coupon } = await import('../models/Coupon.js');
const { default: Order } = await import('../models/Order.js');
const { default: Category } = await import('../models/Category.js');
const { totals, couponProblem } = await import('../utils/pricing.js');

const MONGO = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/droneshop_test';
let server, base;
let adminToken, aliceToken, bobToken;
let drone, cheap;

const api = async (path, { method = 'GET', body, token, raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: raw ? await res.text() : await res.json().catch(() => ({})), headers: res.headers };
};

const address = { fullName: 'Alice A', address: '1 Main St', city: 'Town', postalCode: '12345', country: 'US' };
const order = (token, items, extra = {}) => api('/api/orders', { method: 'POST', token, body: { items, shippingAddress: address, ...extra } });

before(async () => {
  const dbName = new URL(MONGO).pathname.slice(1);
  assert.ok(dbName.endsWith('_test'), `Refusing to wipe "${dbName}": test database name must end in _test`);
  await mongoose.connect(MONGO);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Product.init(), Coupon.init(), Order.init(), Category.init()]);
  await Category.create(['Camera Drones', 'Toy Drones', 'Accessories'].map((name) => ({ name })));

  await User.create({ name: 'Admin', email: 'admin@test.com', password: 'admin123', isAdmin: true });
  await User.create({ name: 'Alice', email: 'alice@test.com', password: 'alice123' });
  await User.create({ name: 'Bob', email: 'bob@test.com', password: 'bob12345' });
  [drone, cheap] = await Product.create([
    { name: 'Test Drone', brand: 'T', category: 'Camera Drones', description: 'd', price: 600, countInStock: 5 },
    { name: '=HYPERLINK("x")', brand: 'T', category: 'Accessories', description: 'd', price: 20, countInStock: 100 },
  ]);

  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const login = async (email, password) => (await api('/api/auth/login', { method: 'POST', body: { email, password } })).body.token;
  adminToken = await login('admin@test.com', 'admin123');
  aliceToken = await login('alice@test.com', 'alice123');
  bobToken = await login('bob@test.com', 'bob12345');
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
});

describe('pricing', () => {
  test('free shipping above $500, flat $15 below, 8% tax', () => {
    assert.deepEqual(totals(100), { itemsPrice: 100, discountPrice: 0, shippingPrice: 15, taxPrice: 8, totalPrice: 123 });
    assert.equal(totals(600).shippingPrice, 0);
  });
  test('percent and fixed coupons, never below zero', () => {
    assert.equal(totals(200, { type: 'percent', value: 10 }).discountPrice, 20);
    assert.equal(totals(30, { type: 'fixed', value: 50 }).discountPrice, 30);
    assert.equal(totals(30, { type: 'fixed', value: 50 }).totalPrice, 0);
  });
  test('coupon rules', () => {
    const ok = { active: true, minSubtotal: 0, usedCount: 0 };
    assert.equal(couponProblem(ok, 10), null);
    assert.match(couponProblem(null, 10), /Invalid/);
    assert.match(couponProblem({ ...ok, active: false }, 10), /Invalid/);
    assert.match(couponProblem({ ...ok, expiresAt: new Date(Date.now() - 1000) }, 10), /expired/);
    assert.match(couponProblem({ ...ok, usageLimit: 2, usedCount: 2 }, 10), /redeemed/);
    assert.match(couponProblem({ ...ok, minSubtotal: 100 }, 50), /at least/);
  });
});

describe('auth', () => {
  test('register validates input and rejects duplicates', async () => {
    assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'x', email: 'nope', password: '123456' } })).status, 400);
    assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'x', email: 'a@b.co', password: '123' } })).status, 400);
    const ok = await api('/api/auth/register', { method: 'POST', body: { name: 'Carol', email: 'Carol@Test.com', password: 'carol123' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.email, 'carol@test.com');
    assert.equal(ok.body.isAdmin, false);
    assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'x', email: 'carol@test.com', password: 'carol123' } })).status, 400);
  });

  test('login works and rejects bad credentials; non-string input does not crash', async () => {
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'alice@test.com', password: 'wrong' } })).status, 401);
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: { $ne: '' }, password: { $ne: '' } } })).status, 401);
  });

  test('forgot answers the same for known and unknown emails', async () => {
    const a = await api('/api/auth/forgot', { method: 'POST', body: { email: 'alice@test.com' } });
    const b = await api('/api/auth/forgot', { method: 'POST', body: { email: 'nobody@test.com' } });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body, b.body);
  });

  test('reset flow: token works once, expired token fails, password changes', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await User.updateOne({ email: 'bob@test.com' }, { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + 60000) });
    assert.equal((await api('/api/auth/reset', { method: 'POST', body: { token: 'bad', password: 'newpass1' } })).status, 400);
    assert.equal((await api('/api/auth/reset', { method: 'POST', body: { token, password: '123' } })).status, 400);
    const ok = await api('/api/auth/reset', { method: 'POST', body: { token, password: 'newpass1' } });
    assert.equal(ok.status, 200);
    assert.equal((await api('/api/auth/reset', { method: 'POST', body: { token, password: 'again123' } })).status, 400, 'token is single-use');
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'bob@test.com', password: 'newpass1' } })).status, 200);
    // restore for later tests
    await User.findOne({ email: 'bob@test.com' }).then((u) => { u.password = 'bob12345'; return u.save(); });

    const expired = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ email: 'bob@test.com' }, { resetTokenHash: crypto.createHash('sha256').update(expired).digest('hex'), resetTokenExpires: new Date(Date.now() - 1000) });
    assert.equal((await api('/api/auth/reset', { method: 'POST', body: { token: expired, password: 'newpass1' } })).status, 400);
  });
});

describe('account', () => {
  test('requires login', async () => {
    assert.equal((await api('/api/account/addresses')).status, 401);
  });

  test('profile and password changes', async () => {
    assert.equal((await api('/api/account/profile', { method: 'PUT', token: aliceToken, body: { email: 'bob@test.com' } })).status, 400);
    const r = await api('/api/account/profile', { method: 'PUT', token: aliceToken, body: { name: 'Alice Z' } });
    assert.equal(r.body.name, 'Alice Z');
    assert.equal((await api('/api/account/password', { method: 'PUT', token: aliceToken, body: { current: 'bad', next: 'alice456' } })).status, 401);
    assert.equal((await api('/api/account/password', { method: 'PUT', token: aliceToken, body: { current: 'alice123', next: '1' } })).status, 400);
    assert.equal((await api('/api/account/password', { method: 'PUT', token: aliceToken, body: { current: 'alice123', next: 'alice456' } })).status, 200);
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'alice@test.com', password: 'alice456' } })).status, 200);
    await api('/api/account/password', { method: 'PUT', token: aliceToken, body: { current: 'alice456', next: 'alice123' } });
  });

  test('address book keeps exactly one default', async () => {
    const a = await api('/api/account/addresses', { method: 'POST', token: aliceToken, body: address });
    assert.equal(a.status, 201);
    assert.equal(a.body[0].isDefault, true, 'first address becomes default');
    const b = await api('/api/account/addresses', { method: 'POST', token: aliceToken, body: { ...address, label: 'Work', isDefault: true } });
    assert.equal(b.body.filter((x) => x.isDefault).length, 1);
    assert.equal(b.body.find((x) => x.isDefault).label, 'Work');
    const del = await api(`/api/account/addresses/${b.body.find((x) => x.isDefault)._id}`, { method: 'DELETE', token: aliceToken });
    assert.equal(del.body.length, 1);
    assert.equal(del.body[0].isDefault, true, 'default moves to the remaining address');
    assert.equal((await api('/api/account/addresses', { method: 'POST', token: aliceToken, body: { label: 'x' } })).status, 400, 'incomplete address rejected');
  });

  test('wishlist add, list, remove, unknown product', async () => {
    const add = await api(`/api/account/wishlist/${drone._id}`, { method: 'POST', token: aliceToken });
    assert.deepEqual(add.body, [String(drone._id)]);
    await api(`/api/account/wishlist/${drone._id}`, { method: 'POST', token: aliceToken });
    assert.equal((await api('/api/account/wishlist', { token: aliceToken })).body.length, 1, 'no duplicates');
    assert.equal((await api(`/api/account/wishlist/${new mongoose.Types.ObjectId()}`, { method: 'POST', token: aliceToken })).status, 404);
    assert.deepEqual((await api(`/api/account/wishlist/${drone._id}`, { method: 'DELETE', token: aliceToken })).body, []);
  });
});

describe('products', () => {
  test('admins cannot set rating or reviews through the form', async () => {
    const r = await api('/api/products', { method: 'POST', token: adminToken, body: { name: 'N', brand: 'B', category: 'Toy Drones', description: 'd', price: 1, countInStock: 1, rating: 5, numReviews: 99, images: ['/a.jpg', ' ', '/b.jpg'] } });
    assert.equal(r.status, 201);
    assert.equal(r.body.rating, 0);
    assert.equal(r.body.numReviews, 0);
    assert.deepEqual(r.body.images, ['/a.jpg', '/b.jpg']);
  });

  test('customers cannot create products; review moderation is admin-only', async () => {
    assert.equal((await api('/api/products', { method: 'POST', token: aliceToken, body: {} })).status, 403);
    assert.equal((await api(`/api/products/${drone._id}/reviews`, { method: 'POST', token: aliceToken, body: { rating: 4, comment: 'good' } })).status, 201);
    assert.equal((await api(`/api/products/${drone._id}/reviews`, { method: 'POST', token: aliceToken, body: { rating: 4, comment: 'again' } })).status, 400);
    const p = (await api(`/api/products/${drone._id}`)).body;
    assert.equal(p.rating, 4);
    const rid = p.reviews[0]._id;
    assert.equal((await api(`/api/products/${drone._id}/reviews/${rid}`, { method: 'DELETE', token: bobToken })).status, 403);
    assert.equal((await api(`/api/products/${drone._id}/reviews/${rid}`, { method: 'DELETE', token: adminToken })).status, 200);
    const after = (await api(`/api/products/${drone._id}`)).body;
    assert.equal(after.numReviews, 0);
    assert.equal(after.rating, 0);
  });
});

describe('coupons and orders', () => {
  before(async () => {
    await Coupon.create([
      { code: 'TEN', type: 'percent', value: 10 },
      { code: 'ONCE', type: 'fixed', value: 5, usageLimit: 1 },
      { code: 'BIG', type: 'fixed', value: 50, minSubtotal: 1000 },
    ]);
  });

  test('quote applies and validates coupons', async () => {
    const items = [{ product: String(drone._id), qty: 1 }];
    const q = await api('/api/orders/quote', { method: 'POST', token: aliceToken, body: { items, couponCode: 'ten' } });
    assert.equal(q.status, 200);
    assert.equal(q.body.discountPrice, 60);
    assert.equal(q.body.itemsPrice, 600);
    assert.equal((await api('/api/orders/quote', { method: 'POST', token: aliceToken, body: { items, couponCode: 'BIG' } })).status, 400);
    assert.equal((await api('/api/orders/quote', { method: 'POST', token: aliceToken, body: { items, couponCode: 'NOPE' } })).status, 400);
  });

  test('order total ignores any client-supplied prices', async () => {
    const r = await order(aliceToken, [{ product: String(cheap._id), qty: 2, price: 0.01 }], { totalPrice: 1, itemsPrice: 1 });
    assert.equal(r.status, 201);
    assert.equal(r.body.itemsPrice, 40);
    assert.equal(r.body.totalPrice, 40 + 15 + 3.2);
    await api(`/api/orders/${r.body._id}/cancel`, { method: 'PUT', token: aliceToken });
  });

  test('rejects bad payloads', async () => {
    assert.equal((await order(aliceToken, [])).status, 400);
    assert.equal((await order(aliceToken, [{ product: String(drone._id), qty: 0 }])).status, 400);
    assert.equal((await order(aliceToken, [{ product: String(drone._id), qty: 1.5 }])).status, 400);
    assert.equal((await order(aliceToken, [{ product: String(drone._id), qty: 1 }, { product: String(drone._id), qty: 1 }])).status, 400, 'duplicate lines');
    assert.equal((await api('/api/orders', { method: 'POST', token: aliceToken, body: { items: [{ product: String(drone._id), qty: 1 }], shippingAddress: { fullName: 'x' } } })).status, 400);
    assert.equal((await order(aliceToken, [{ product: String(drone._id), qty: 1 }], { paymentMethod: 'Bitcoin' })).status, 400);
    assert.equal((await api('/api/orders', { method: 'POST', body: {} })).status, 401);
  });

  test('stock is reserved, oversell refused, cancel restores stock and coupon use', async () => {
    const before = (await Product.findById(drone._id)).countInStock;
    const o = await order(aliceToken, [{ product: String(drone._id), qty: 2 }], { couponCode: 'ONCE' });
    assert.equal(o.status, 201);
    assert.equal(o.body.discountPrice, 5);
    assert.equal(o.body.coupon.code, 'ONCE');
    assert.equal((await Product.findById(drone._id)).countInStock, before - 2);
    assert.equal((await Coupon.findOne({ code: 'ONCE' })).usedCount, 1);

    // single-use coupon is now exhausted
    const again = await order(bobToken, [{ product: String(cheap._id), qty: 1 }], { couponCode: 'ONCE' });
    assert.equal(again.status, 400);
    assert.match(again.body.message, /redeemed/);
    assert.equal((await Product.findById(cheap._id)).countInStock, 100, 'failed order leaves stock untouched');

    assert.equal((await order(bobToken, [{ product: String(drone._id), qty: before }])).status, 400, 'oversell');

    // another customer cannot cancel it; the owner can
    assert.equal((await api(`/api/orders/${o.body._id}/cancel`, { method: 'PUT', token: bobToken })).status, 404);
    const c = await api(`/api/orders/${o.body._id}/cancel`, { method: 'PUT', token: aliceToken });
    assert.equal(c.status, 200);
    assert.equal(c.body.status, 'Cancelled');
    assert.equal(c.body.cancelledBy, 'customer');
    assert.equal((await Product.findById(drone._id)).countInStock, before);
    assert.equal((await Coupon.findOne({ code: 'ONCE' })).usedCount, 0);
    assert.equal((await api(`/api/orders/${o.body._id}/cancel`, { method: 'PUT', token: aliceToken })).status, 400, 'cannot cancel twice');
    assert.equal((await Product.findById(drone._id)).countInStock, before, 'second cancel did not double-restock');
  });

  test('concurrent orders never oversell the last units', async () => {
    const p = await Product.create({ name: 'Last Ones', brand: 'T', category: 'Toy Drones', description: 'd', price: 10, countInStock: 3 });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => order(i % 2 ? aliceToken : bobToken, [{ product: String(p._id), qty: 1 }]))
    );
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.equal((await Product.findById(p._id)).countInStock, 0);
  });

  test('tracking ships an order; shipped orders cannot be customer-cancelled', async () => {
    const o = await order(aliceToken, [{ product: String(cheap._id), qty: 1 }]);
    assert.equal((await api(`/api/orders/${o.body._id}/tracking`, { method: 'PUT', token: aliceToken, body: { number: '1' } })).status, 403);
    assert.equal((await api(`/api/orders/${o.body._id}/tracking`, { method: 'PUT', token: adminToken, body: { carrier: 'UPS' } })).status, 400, 'number required');
    assert.equal((await api(`/api/orders/${o.body._id}/tracking`, { method: 'PUT', token: adminToken, body: { number: '1Z', url: 'javascript:alert(1)' } })).status, 400, 'only http(s) links');
    const t = await api(`/api/orders/${o.body._id}/tracking`, { method: 'PUT', token: adminToken, body: { carrier: 'UPS', number: '1Z999', url: 'https://ups.example/track/1Z999' } });
    assert.equal(t.status, 200);
    assert.equal(t.body.status, 'Shipped');
    assert.ok(t.body.shippedAt);
    assert.equal((await api(`/api/orders/${o.body._id}/cancel`, { method: 'PUT', token: aliceToken })).status, 400);
    // customer sees tracking on their own order, other customers do not see the order at all
    assert.equal((await api(`/api/orders/${o.body._id}`, { token: aliceToken })).body.tracking.number, '1Z999');
    assert.equal((await api(`/api/orders/${o.body._id}`, { token: bobToken })).status, 404);
  });

  test('admin status rules: validation, delivered marks paid, cancelled cannot reopen', async () => {
    const o = await order(aliceToken, [{ product: String(cheap._id), qty: 1 }]);
    const id = o.body._id;
    assert.equal((await api(`/api/orders/${id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Bogus' } })).status, 400);
    const d = await api(`/api/orders/${id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Delivered' } });
    assert.equal(d.body.isPaid, true);
    const o2 = await order(aliceToken, [{ product: String(cheap._id), qty: 1 }]);
    await api(`/api/orders/${o2.body._id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Cancelled' } });
    assert.equal((await api(`/api/orders/${o2.body._id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Shipped' } })).status, 400);
  });
});

describe('admin', () => {
  test('stats, users and coupons are admin-only', async () => {
    for (const path of ['/api/admin/stats', '/api/admin/users', '/api/admin/coupons', '/api/admin/export/orders.csv']) {
      assert.equal((await api(path, { token: aliceToken })).status, 403, path);
      assert.equal((await api(path)).status, 401, path);
    }
    const s = await api('/api/admin/stats', { token: adminToken });
    assert.equal(s.status, 200);
    assert.equal(s.body.last7.length, 7);
  });

  test('coupon CRUD with validation and duplicate codes', async () => {
    const c = await api('/api/admin/coupons', { method: 'POST', token: adminToken, body: { code: 'summer25', type: 'percent', value: 25, usageLimit: '', expiresAt: '' } });
    assert.equal(c.status, 201);
    assert.equal(c.body.code, 'SUMMER25');
    assert.equal((await api('/api/admin/coupons', { method: 'POST', token: adminToken, body: { code: 'SUMMER25', type: 'fixed', value: 5 } })).status, 400);
    assert.equal((await api('/api/admin/coupons', { method: 'POST', token: adminToken, body: { code: 'OVER', type: 'percent', value: 150 } })).status, 400);
    assert.equal((await api('/api/admin/coupons', { method: 'POST', token: adminToken, body: { code: 'bad code!', type: 'fixed', value: 5 } })).status, 400);
    const u = await api(`/api/admin/coupons/${c.body._id}`, { method: 'PUT', token: adminToken, body: { active: false } });
    assert.equal(u.body.active, false);
    const q = await api('/api/orders/quote', { method: 'POST', token: aliceToken, body: { items: [{ product: String(cheap._id), qty: 1 }], couponCode: 'SUMMER25' } });
    assert.equal(q.status, 400, 'inactive coupon is refused');
    assert.equal((await api(`/api/admin/coupons/${c.body._id}`, { method: 'DELETE', token: adminToken })).status, 200);
  });

  test('CSV export neutralises spreadsheet formulas and quotes commas', async () => {
    const r = await api('/api/admin/export/products.csv', { token: adminToken, raw: true });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.ok(r.body.includes(`"'=HYPERLINK(""x"")"`), 'formula cell is prefixed and quoted');
    assert.ok(!/,=HYPERLINK/.test(r.body), 'no raw formula cell');
    const o = await api('/api/admin/export/orders.csv', { token: adminToken, raw: true });
    assert.equal(o.status, 200);
    assert.ok(o.body.split('\r\n').length > 2);
  });

  test('admins cannot demote or delete themselves', async () => {
    const me = await User.findOne({ email: 'admin@test.com' });
    assert.equal((await api(`/api/admin/users/${me._id}/admin`, { method: 'PUT', token: adminToken, body: { isAdmin: false } })).status, 400);
    assert.equal((await api(`/api/admin/users/${me._id}`, { method: 'DELETE', token: adminToken })).status, 400);
  });
});

describe('platform', () => {
  test('security headers and no x-powered-by', async () => {
    const r = await api('/api/health');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  test('robots.txt and sitemap.xml', async () => {
    const robots = await api('/robots.txt', { raw: true });
    assert.match(robots.body, /Disallow: \/admin/);
    const map = await api('/sitemap.xml', { raw: true });
    assert.match(map.body, /<urlset/);
    assert.ok(map.body.includes(`/product/${drone._id}`));
  });

  test('unknown routes return JSON 404', async () => {
    const r = await api('/api/nope');
    assert.equal(r.status, 404);
    assert.ok(r.body.message);
  });
});

describe('categories, related, cart, returns, import', () => {
  test('categories: public list, admin CRUD, rename moves products, delete blocked while used', async () => {
    const list = await api('/api/categories');
    assert.equal(list.status, 200);
    assert.ok(list.body.find((c) => c.name === 'Camera Drones').productCount >= 1);
    assert.equal((await api('/api/categories', { method: 'POST', token: aliceToken, body: { name: 'X' } })).status, 403);
    const made = await api('/api/categories', { method: 'POST', token: adminToken, body: { name: 'Batteries' } });
    assert.equal(made.status, 201);
    assert.equal((await api('/api/categories', { method: 'POST', token: adminToken, body: { name: 'Batteries' } })).status, 400, 'duplicate');
    assert.equal((await api('/api/categories', { method: 'POST', token: adminToken, body: { name: '  ' } })).status, 400);

    const p = await api('/api/products', { method: 'POST', token: adminToken, body: { name: 'Pack', brand: 'B', category: 'Batteries', description: 'd', price: 5, countInStock: 1 } });
    assert.equal(p.status, 201);
    assert.equal((await api('/api/products', { method: 'POST', token: adminToken, body: { name: 'Bad', brand: 'B', category: 'Nope', description: 'd', price: 5, countInStock: 1 } })).status, 400, 'unknown category');
    assert.equal((await api(`/api/categories/${made.body._id}`, { method: 'DELETE', token: adminToken })).status, 400, 'in use');
    assert.equal((await api(`/api/categories/${made.body._id}`, { method: 'PUT', token: adminToken, body: { name: 'Battery Packs' } })).status, 200);
    assert.equal((await api(`/api/products/${p.body._id}`)).body.category, 'Battery Packs');
    await api(`/api/products/${p.body._id}`, { method: 'DELETE', token: adminToken });
    assert.equal((await api(`/api/categories/${made.body._id}`, { method: 'DELETE', token: adminToken })).status, 200);
  });

  test('related products and by-ids', async () => {
    const mate = await Product.create({ name: 'Mate', brand: 'T', category: 'Camera Drones', description: 'd', price: 700, countInStock: 1 });
    const rel = await api(`/api/products/${drone._id}/related`);
    assert.equal(rel.status, 200);
    assert.ok(rel.body.some((p) => p._id === String(mate._id)));
    assert.ok(!rel.body.some((p) => p._id === String(drone._id)), 'not itself');
    assert.deepEqual((await api('/api/products/nope/related')).body, []);
    const ids = `${cheap._id},bad,${drone._id}`;
    assert.deepEqual((await api(`/api/products/by-ids?ids=${ids}`)).body.map((p) => p._id), [String(cheap._id), String(drone._id)]);
  });

  test('saved cart: requires login, merges duplicates, drops unknown items', async () => {
    assert.equal((await api('/api/account/cart')).status, 401);
    const put = await api('/api/account/cart', { method: 'PUT', token: bobToken, body: { items: [
      { product: String(cheap._id), qty: 2 }, { product: String(cheap._id), qty: 1 }, { product: 'junk', qty: 1 }, { product: String(drone._id), qty: 0 },
    ] } });
    assert.equal(put.status, 200);
    assert.equal(put.body.length, 1);
    assert.equal(put.body[0].qty, 3);
    assert.equal(put.body[0].price, 20);
    assert.equal((await api('/api/account/cart', { token: bobToken })).body[0].product, String(cheap._id));
    assert.equal((await api('/api/account/cart', { method: 'PUT', token: bobToken, body: { items: 'x' } })).status, 400);
    assert.deepEqual((await api('/api/account/cart', { method: 'PUT', token: bobToken, body: { items: [] } })).body, []);
  });

  test('returns: delivered only, one request, admin decides, refund restocks', async () => {
    const o = await order(aliceToken, [{ product: String(cheap._id), qty: 2 }]);
    const id = o.body._id;
    const ask = (token, reason) => api(`/api/orders/${id}/return`, { method: 'POST', token, body: { reason } });
    assert.equal((await ask(aliceToken, 'too early please')).status, 400, 'not delivered yet');
    await api(`/api/orders/${id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Delivered' } });
    assert.equal((await ask(bobToken, 'not my order')).status, 404);
    assert.equal((await ask(aliceToken, 'no')).status, 400, 'reason too short');
    const r = await ask(aliceToken, 'Arrived damaged');
    assert.equal(r.status, 201);
    assert.equal(r.body.returnRequest.status, 'Requested');
    assert.equal((await ask(aliceToken, 'again please')).status, 400, 'only one request');

    const decide = (token, decision, note) => api(`/api/orders/${id}/return`, { method: 'PUT', token, body: { decision, note } });
    assert.equal((await decide(aliceToken, 'refund')).status, 403);
    assert.equal((await decide(adminToken, 'bogus')).status, 400);
    assert.equal((await decide(adminToken, 'approve', 'Send it back')).body.returnRequest.status, 'Approved');
    assert.equal((await decide(adminToken, 'reject')).status, 400, 'approved return cannot be rejected');
    const stockBefore = (await Product.findById(cheap._id)).countInStock;
    const refund = await decide(adminToken, 'refund');
    assert.equal(refund.body.returnRequest.status, 'Refunded');
    assert.equal(refund.body.isRefunded, true);
    assert.equal((await Product.findById(cheap._id)).countInStock, stockBefore + 2, 'items back in stock');
    assert.equal((await decide(adminToken, 'refund')).status, 400, 'no double refund');
  });

  test('return window closes after 30 days', async () => {
    const o = await order(aliceToken, [{ product: String(cheap._id), qty: 1 }]);
    await api(`/api/orders/${o.body._id}/status`, { method: 'PUT', token: adminToken, body: { status: 'Delivered' } });
    await Order.updateOne({ _id: o.body._id }, { deliveredAt: new Date(Date.now() - 31 * 86400000) });
    const r = await api(`/api/orders/${o.body._id}/return`, { method: 'POST', token: aliceToken, body: { reason: 'Changed my mind' } });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /window/);
  });

  test('product CSV import: creates, updates, reports row errors, handles quotes', async () => {
    const csv = [
      'Name,Brand,Category,Price,Stock,Description,Image',
      'Imported A,Acme,Toy Drones,19.99,5,"Small, light ""fun"" drone",/images/a.jpg',
      'Imported B,Acme,Nope,10,1,desc,',
      'Imported C,Acme,Toy Drones,abc,1,desc,',
      'Imported D,Acme,Toy Drones,10,1.5,desc,',
      'Imported E,Acme,Toy Drones,10,1,desc,javascript:alert(1)',
    ].join('\r\n');
    assert.equal((await api('/api/admin/import/products', { method: 'POST', token: aliceToken, body: { csv } })).status, 403);
    const r = await api('/api/admin/import/products', { method: 'POST', token: adminToken, body: { csv } });
    assert.equal(r.status, 200);
    assert.equal(r.body.created, 1);
    assert.deepEqual(r.body.errors.map((e) => e.line), [3, 4, 5, 6]);
    const a = await Product.findOne({ name: 'Imported A' });
    assert.equal(a.description, 'Small, light "fun" drone');

    const again = await api('/api/admin/import/products', { method: 'POST', token: adminToken, body: { csv: 'name,brand,category,price,stock,description\nImported A,Acme,Toy Drones,25,9,New text' } });
    assert.equal(again.body.updated, 1);
    assert.equal(again.body.created, 0);
    const a2 = await Product.findOne({ name: 'Imported A' });
    assert.equal(a2.price, 25);
    assert.equal(a2.countInStock, 9);

    assert.equal((await api('/api/admin/import/products', { method: 'POST', token: adminToken, body: { csv: 'name,brand\nx,y' } })).status, 400, 'missing columns');
    assert.equal((await api('/api/admin/import/products', { method: 'POST', token: adminToken, body: {} })).status, 400);
  });
});


describe('user management and roles', () => {
  let carol, supportToken, managerToken;
  const admin = (path, opts = {}) => api(`/api/admin${path}`, { token: adminToken, ...opts });

  test('admin creates users with roles; validation and duplicates', async () => {
    const mk = (body, token = adminToken) => api('/api/admin/users', { method: 'POST', token, body });
    assert.equal((await mk({ name: 'X', email: 'x@t.co', password: 'secret1' }, aliceToken)).status, 403);
    assert.equal((await mk({ name: '', email: 'x@t.co', password: 'secret1' })).status, 400);
    assert.equal((await mk({ name: 'X', email: 'bad', password: 'secret1' })).status, 400);
    assert.equal((await mk({ name: 'X', email: 'x@t.co', password: '123' })).status, 400);
    assert.equal((await mk({ name: 'X', email: 'x@t.co', password: 'secret1', role: 'wizard' })).status, 400);
    const s = await mk({ name: 'Sam Support', email: 'Sam@Test.com', password: 'support1', role: 'support' });
    assert.equal(s.status, 201);
    assert.equal(s.body.role, 'support');
    assert.equal(s.body.email, 'sam@test.com');
    assert.equal(s.body.password, undefined);
    assert.equal((await mk({ name: 'Dup', email: 'sam@test.com', password: 'secret1' })).status, 400);
    const m = await mk({ name: 'Max Manager', email: 'max@test.com', password: 'manager1', role: 'manager' });
    assert.equal(m.body.role, 'manager');
    carol = (await User.findOne({ email: 'carol@test.com' }))._id;
    const login = async (email, password) => (await api('/api/auth/login', { method: 'POST', body: { email, password } }));
    const ls = await login('sam@test.com', 'support1');
    assert.equal(ls.body.role, 'support');
    assert.equal(ls.body.isAdmin, false);
    assert.ok(ls.body.permissions.includes('orders'));
    supportToken = ls.body.token;
    managerToken = (await login('max@test.com', 'manager1')).body.token;
  });

  test('roles limit what staff can reach', async () => {
    const get = (path, token) => api(path, { token });
    // support: orders yes; catalogue, coupons, stats, user changes no
    assert.equal((await get('/api/orders', supportToken)).status, 200);
    assert.equal((await get('/api/admin/users', supportToken)).status, 200);
    assert.equal((await get('/api/admin/stats', supportToken)).status, 403);
    assert.equal((await get('/api/admin/coupons', supportToken)).status, 403);
    assert.equal((await api('/api/products', { method: 'POST', token: supportToken, body: {} })).status, 403);
    assert.equal((await api(`/api/admin/users/${carol}`, { method: 'PUT', token: supportToken, body: { name: 'Z' } })).status, 403);
    // manager: catalogue, coupons, stats; cannot manage users or roles
    assert.equal((await get('/api/admin/stats', managerToken)).status, 200);
    assert.equal((await get('/api/admin/coupons', managerToken)).status, 200);
    assert.equal((await get('/api/admin/users', managerToken)).status, 200);
    assert.equal((await api('/api/admin/users', { method: 'POST', token: managerToken, body: { name: 'N', email: 'n@t.co', password: 'secret1' } })).status, 403);
    assert.equal((await api(`/api/admin/users/${carol}/role`, { method: 'PUT', token: managerToken, body: { role: 'admin' } })).status, 403);
    assert.equal((await api(`/api/admin/users/${carol}`, { method: 'DELETE', token: managerToken })).status, 403);
    // support can view a customer's order but a plain customer cannot view someone else's
    const o = await order(aliceToken, [{ product: String(cheap._id), qty: 1 }]);
    assert.equal((await get(`/api/orders/${o.body._id}`, supportToken)).status, 200);
    assert.equal((await get(`/api/orders/${o.body._id}`, bobToken)).status, 404);
    // /auth/me reflects the current role
    assert.equal((await get('/api/auth/me', managerToken)).body.role, 'manager');
  });

  test('list: search, role and status filters, pagination', async () => {
    const all = await admin('/users');
    assert.equal(all.status, 200);
    assert.ok(all.body.total >= 5);
    assert.ok(all.body.users.every((u) => u.password === undefined && u.role));
    assert.deepEqual((await admin('/users?q=sam%40test')).body.users.map((u) => u.email), ['sam@test.com']);
    assert.equal((await admin('/users?q=.*')).body.total, 0, 'search text is not a regex');
    assert.deepEqual((await admin('/users?role=support')).body.users.map((u) => u.role), ['support']);
    assert.ok((await admin('/users?role=customer')).body.users.every((u) => u.role === 'customer'));
    assert.ok((await admin('/users?role=admin')).body.users.every((u) => u.isAdmin));
    assert.equal((await admin('/users?limit=2')).body.users.length, 2);
    assert.equal((await admin('/users?status=suspended')).body.total, 0);
  });

  test('detail shows profile, order totals and recent orders', async () => {
    const alice = await User.findOne({ email: 'alice@test.com' });
    const d = await admin(`/users/${alice._id}`);
    assert.equal(d.status, 200);
    assert.equal(d.body.email, 'alice@test.com');
    assert.ok(d.body.orders >= 1);
    assert.ok(Array.isArray(d.body.recentOrders));
    assert.equal((await admin('/users/nope')).status, 404);
    assert.equal((await admin(`/users/${new mongoose.Types.ObjectId()}`)).status, 404);
  });

  test('edit profile, suspend blocks sign-in and live sessions, reinstate restores', async () => {
    const bob = await User.findOne({ email: 'bob@test.com' });
    const put = (body) => admin(`/users/${bob._id}`, { method: 'PUT', body });
    assert.equal((await put({ name: ' ' })).status, 400);
    assert.equal((await put({ email: 'alice@test.com' })).status, 400, 'email taken');
    assert.equal((await put({ name: 'Bobby' })).body.name, 'Bobby');
    assert.equal((await put({ disabled: true })).body.disabled, true);
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'bob@test.com', password: 'bob12345' } })).status, 403);
    assert.equal((await api('/api/orders/mine', { token: bobToken })).status, 401, 'existing token stops working');
    assert.equal((await put({ disabled: false })).body.disabled, false);
    assert.equal((await api('/api/orders/mine', { token: bobToken })).status, 200);
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'bob@test.com', password: 'bob12345' } })).status, 200);
  });

  test('role changes: promote, demote, guard rails', async () => {
    const setRole = (id, role, token = adminToken) => api(`/api/admin/users/${id}/role`, { method: 'PUT', token, body: { role } });
    assert.equal((await setRole(carol, 'wizard')).status, 400);
    assert.equal((await setRole(carol, 'manager')).body.role, 'manager');
    const meAdmin = await User.findOne({ email: 'admin@test.com' });
    assert.equal((await setRole(meAdmin._id, 'customer')).status, 400, 'not your own role');
    // promote carol to admin, then admin can be demoted again because another admin exists
    const promoted = await setRole(carol, 'admin');
    assert.equal(promoted.body.isAdmin, true);
    assert.equal((await api('/api/admin/users', { token: (await api('/api/auth/login', { method: 'POST', body: { email: 'carol@test.com', password: 'carol123' } })).body.token })).status, 200);
    assert.equal((await setRole(carol, 'customer')).body.isAdmin, false);
    assert.equal((await User.findById(carol)).role, 'customer', 'demotion sticks after save');
  });

  test('admins can manage each other but never themselves; a suspended admin is locked out', async () => {
    const meAdmin = await User.findOne({ email: 'admin@test.com' });
    const second = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Second', email: 'second@test.com', password: 'second12', role: 'admin' } });
    assert.equal(second.body.isAdmin, true);
    const secondToken = (await api('/api/auth/login', { method: 'POST', body: { email: 'second@test.com', password: 'second12' } })).body.token;
    assert.equal((await api(`/api/admin/users/${second.body._id}`, { method: 'PUT', token: secondToken, body: { disabled: true } })).status, 400, 'cannot suspend yourself');
    assert.equal((await api(`/api/admin/users/${second.body._id}`, { method: 'DELETE', token: secondToken })).status, 400, 'cannot delete yourself');
    assert.equal((await admin(`/users/${meAdmin._id}`, { method: 'PUT', body: { disabled: true } })).status, 400, 'cannot suspend yourself (first admin)');
    assert.equal((await admin(`/users/${second.body._id}`, { method: 'PUT', body: { disabled: true } })).status, 200);
    assert.equal((await api('/api/admin/users', { token: secondToken })).status, 401, 'suspended admin is locked out');
    assert.equal((await admin(`/users/${second.body._id}`, { method: 'DELETE' })).status, 200);
  });
  test('admin-triggered password reset and delete', async () => {
    const dave = await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Dave', email: 'dave@test.com', password: 'dave1234' } });
    const r = await admin(`/users/${dave.body._id}/reset-password`, { method: 'POST' });
    assert.equal(r.status, 200);
    assert.match(r.body.message, /dave@test.com/);
    const stored = await User.findById(dave.body._id).select('+resetTokenHash +resetTokenExpires');
    assert.ok(stored.resetTokenHash && stored.resetTokenExpires > new Date());
    assert.equal((await api(`/api/admin/users/${dave.body._id}/reset-password`, { method: 'POST', token: supportToken })).status, 403);
    assert.equal((await admin(`/users/${dave.body._id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin(`/users/${dave.body._id}`)).status, 404);
  });

  test('roles overview lists permissions and user counts', async () => {
    const r = await admin('/roles');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.roles.map((x) => x.name), ['customer', 'support', 'manager', 'admin']);
    assert.ok(r.body.roles.find((x) => x.name === 'admin').permissions.includes('roles'));
    assert.ok(r.body.roles.find((x) => x.name === 'support').users >= 1);
    assert.ok(r.body.permissions['users.manage']);
    assert.equal((await api('/api/admin/roles', { token: aliceToken })).status, 403);
  });
});



describe('reports', () => {
  let managerToken, supportToken;
  const get = (path, token = adminToken, raw = false) => api(`/api/admin/reports${path}`, { token, raw });

  before(async () => {
    const login = async (email, password) => (await api('/api/auth/login', { method: 'POST', body: { email, password } })).body.token;
    await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Rita Reports', email: 'rita@test.com', password: 'rita1234', role: 'manager' } });
    await api('/api/admin/users', { method: 'POST', token: adminToken, body: { name: 'Sid Support', email: 'sid@test.com', password: 'sid12345', role: 'support' } });
    managerToken = await login('rita@test.com', 'rita1234');
    supportToken = await login('sid@test.com', 'sid12345');
  });

  test('only roles with the reports permission can run them', async () => {
    assert.equal((await get('/sales', aliceToken)).status, 403);
    assert.equal((await get('/sales', supportToken)).status, 403);
    assert.equal((await get('/sales', managerToken)).status, 200);
    assert.equal((await get('/sales', adminToken)).status, 200);
    assert.equal((await api('/api/admin/reports/sales')).status, 401);
    assert.equal((await get('/sales?format=csv', supportToken, true)).status, 403);
  });

  test('validates type, dates and grouping', async () => {
    assert.equal((await get('/nope')).status, 404);
    assert.equal((await get('/sales?from=2026-13-01')).status, 400);
    assert.equal((await get('/sales?from=2026-02-30&to=2026-03-01')).status, 400, 'not a real date');
    assert.equal((await get('/sales?from=yesterday')).status, 400);
    assert.equal((await get('/sales?from=2026-05-02&to=2026-05-01')).status, 400, 'start after end');
    assert.equal((await get('/sales?from=2020-01-01&to=2026-01-01')).status, 400, 'range too long');
    assert.equal((await get('/sales?group=year')).status, 400);
    assert.equal((await get('/')).body.includes('inventory'), true);
  });

  test('sales totals match the orders in the database; daily rows include empty days', async () => {
    const r = await get('/sales');
    assert.equal(r.status, 200);
    assert.equal(r.body.rows.length, 30, 'default range is 30 days');
    const live = await Order.find({ status: { $ne: 'Cancelled' }, isRefunded: { $ne: true } });
    const revenue = r.body.summary.find((s) => s[0] === 'Revenue')[1];
    assert.equal(revenue, Math.round(live.reduce((s, o) => s + o.totalPrice, 0) * 100) / 100);
    assert.equal(r.body.summary.find((s) => s[0] === 'Orders')[1], live.length);
    assert.equal(r.body.summary.find((s) => s[0] === 'Units sold')[1], live.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0));
    const refunded = await Order.find({ isRefunded: true });
    assert.ok(refunded.length >= 1);
    assert.equal(r.body.summary.find((s) => s[0] === 'Refunds')[1], Math.round(refunded.reduce((s, o) => s + o.totalPrice, 0) * 100) / 100);
    assert.equal(r.body.from.length, 10);
  });

  test('week and month grouping, and a range with no orders', async () => {
    assert.match((await get('/sales?group=month')).body.rows[0].period, /^\d{4}-\d{2}$/);
    assert.match((await get('/sales?group=week')).body.rows[0].period, /^\d{4}-W\d{2}$/);
    const old = await get('/sales?from=2001-01-01&to=2001-01-10');
    assert.equal(old.body.rows.length, 10);
    assert.ok(old.body.rows.every((x) => x.revenue === 0 && x.orders === 0));
    assert.equal(old.body.summary.find((s) => s[0] === 'Average order')[1], 0);
    assert.equal((await get('/products?from=2001-01-01&to=2001-01-10')).body.rows.length, 0);
  });

  test('product and category reports agree with each other', async () => {
    const p = await get('/products');
    const c = await get('/categories');
    const sum = (rows) => Math.round(rows.reduce((s, x) => s + x.revenue, 0) * 100) / 100;
    assert.ok(p.body.rows.length >= 1);
    assert.equal(sum(p.body.rows), sum(c.body.rows));
    assert.ok(p.body.rows.every((x, i, a) => i === 0 || a[i - 1].revenue >= x.revenue), 'sorted by revenue');
    const pct = c.body.rows.reduce((s, x) => s + x.share, 0);
    assert.ok(Math.abs(pct - 100) < 0.2, `shares add to 100 (got ${pct})`);
  });

  test('customers, coupons, inventory and returns reports', async () => {
    const o = await order(aliceToken, [{ product: String(drone._id), qty: 1 }], { couponCode: 'TEN' });
    assert.equal(o.status, 201);
    const cust = await get('/customers');
    assert.ok(cust.body.rows.find((x) => x.email === 'alice@test.com').spent > 0);
    const cp = await get('/coupons');
    const ten = cp.body.rows.find((x) => x.code === 'TEN');
    assert.ok(ten && ten.uses >= 1 && ten.discount > 0);
    const inv = await get('/inventory');
    assert.equal(inv.body.rows.length, await Product.countDocuments());
    assert.equal(inv.body.snapshot, true);
    assert.ok(inv.body.rows.every((x) => x.value === Math.round(x.price * x.stock * 100) / 100));
    assert.ok(inv.body.rows.some((x) => x.status === 'Out of stock'), 'the concurrency test sold out a product');
    const ret = await get('/returns');
    assert.ok(ret.body.rows.some((x) => x.status === 'Refunded'));
    await api(`/api/orders/${o.body._id}/cancel`, { method: 'PUT', token: aliceToken });
  });

  test('CSV export: headers, filename, formula-safe text, plain numbers', async () => {
    const r = await get('/products?format=csv', adminToken, true);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.match(r.headers.get('content-disposition'), /report-products-\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv/);
    const lines = r.body.replace(/^ï»¿/, '').split('\r\n');
    assert.equal(lines[0], 'Product,Units sold,Orders,Revenue,Average price');
    assert.ok(lines.some((l) => l.startsWith(`"'=HYPERLINK`)), 'formula neutralised');
    assert.ok(lines.slice(1).every((l) => !/'\d/.test(l.split(',').slice(-1)[0])), 'numbers not prefixed');
    const inv = await get('/inventory?format=csv', adminToken, true);
    assert.match(inv.headers.get('content-disposition'), /report-inventory-\d{4}-\d{2}-\d{2}\.csv/);
    const sales = await get('/sales?format=csv&group=month', adminToken, true);
    assert.ok(sales.body.includes('Month,Orders,Units'));
  });
});

