import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { mail } from '../utils/mailer.js';
import { roleOf, permissionsOf } from '../utils/permissions.js';

const router = Router();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
export const identity = (u) => ({
  _id: u._id, name: u.name, email: u.email, isAdmin: roleOf(u) === 'admin', role: roleOf(u), permissions: permissionsOf(u),
});
export const payload = (u) => ({ ...identity(u), token: sign(u._id) });
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !isEmail(email) || typeof password !== 'string' || password.length < 6) {
      res.status(400);
      throw new Error('A name, a valid email and a password of at least 6 characters are required');
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      res.status(400);
      throw new Error('Email already registered');
    }
    const user = await User.create({ name, email, password });
    res.status(201).json(payload(user));
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await user.matchPassword(String(password || '')))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
    if (user.disabled) {
      res.status(403);
      throw new Error('This account has been suspended. Contact support.');
    }
    user.lastLoginAt = new Date();
    await user.save();
    res.json(payload(user));
  } catch (err) {
    next(err);
  }
});

// Current identity, so the client can pick up role changes without signing in again.
router.get('/me', protect, (req, res) => res.json(identity(req.user)));

// Always answers the same way so the endpoint cannot be used to discover which emails are registered.
router.post('/forgot', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const user = isEmail(email) ? await User.findOne({ email }) : null;
    if (user && !user.disabled) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = sha256(token);
      user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      mail.passwordReset(user, token);
    }
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 6) {
      res.status(400);
      throw new Error('A valid token and a password of at least 6 characters are required');
    }
    const user = await User.findOne({
      resetTokenHash: sha256(token),
      resetTokenExpires: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpires');
    if (!user) {
      res.status(400);
      throw new Error('This reset link is invalid or has expired');
    }
    user.password = password;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    res.json(payload(user));
  } catch (err) {
    next(err);
  }
});

export default router;
