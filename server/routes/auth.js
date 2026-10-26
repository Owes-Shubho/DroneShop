import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const payload = (u) => ({ _id: u._id, name: u.name, email: u.email, isAdmin: u.isAdmin, token: sign(u._id) });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email and password are required');
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
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await user.matchPassword(password || ''))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
    res.json(payload(user));
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, (req, res) => res.json(req.user));

export default router;
