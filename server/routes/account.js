import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';
import { payload } from './auth.js';

const router = Router();
router.use(protect);

const MAX_ADDRESSES = 10;
const ADDRESS_FIELDS = ['label', 'fullName', 'address', 'city', 'postalCode', 'country'];
const pickAddress = (body) => Object.fromEntries(ADDRESS_FIELDS.filter((k) => typeof body[k] === 'string').map((k) => [k, body[k]]));

const bad = (res, msg) => {
  res.status(400);
  return new Error(msg);
};

// ----- profile -----
router.get('/profile', (req, res) => res.json(req.user));

router.put('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, email } = req.body;
    if (typeof name === 'string' && name.trim()) user.name = name.trim();
    if (typeof email === 'string' && email.toLowerCase() !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad(res, 'Enter a valid email');
      if (await User.findOne({ email: email.toLowerCase() })) throw bad(res, 'Email already registered');
      user.email = email;
    }
    await user.save();
    res.json(payload(user));
  } catch (err) {
    next(err);
  }
});

router.put('/password', async (req, res, next) => {
  try {
    const { current, next: newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(String(current || '')))) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) throw bad(res, 'New password must be at least 6 characters');
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

// ----- address book -----
router.get('/addresses', (req, res) => res.json(req.user.addresses));

router.post('/addresses', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.addresses.length >= MAX_ADDRESSES) throw bad(res, `You can save up to ${MAX_ADDRESSES} addresses`);
    const addr = pickAddress(req.body);
    if (req.body.isDefault || user.addresses.length === 0) {
      user.addresses.forEach((a) => { a.isDefault = false; });
      addr.isDefault = true;
    }
    user.addresses.push(addr);
    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    next(err);
  }
});

router.put('/addresses/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) {
      res.status(404);
      throw new Error('Address not found');
    }
    addr.set(pickAddress(req.body));
    if (req.body.isDefault) {
      user.addresses.forEach((a) => { a.isDefault = a._id.equals(addr._id); });
    }
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.id);
    if (!addr) {
      res.status(404);
      throw new Error('Address not found');
    }
    const wasDefault = addr.isDefault;
    addr.deleteOne();
    if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    next(err);
  }
});

// ----- wishlist -----
router.get('/wishlist', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({ path: 'wishlist', select: '-reviews' });
    res.json(user.wishlist.filter(Boolean));
  } catch (err) {
    next(err);
  }
});

router.get('/wishlist/ids', (req, res) => res.json(req.user.wishlist.map(String)));

router.post('/wishlist/:productId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId) || !(await Product.exists({ _id: req.params.productId }))) {
      res.status(404);
      throw new Error('Product not found');
    }
    await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } });
    const user = await User.findById(req.user._id);
    res.status(201).json(user.wishlist.map(String));
  } catch (err) {
    next(err);
  }
});

router.delete('/wishlist/:productId', async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
    const user = await User.findById(req.user._id);
    res.json(user.wishlist.map(String));
  } catch (err) {
    next(err);
  }
});

export default router;
