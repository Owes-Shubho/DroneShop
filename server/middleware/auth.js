import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) throw new Error('User no longer exists');
    next();
  } catch (err) {
    res.status(401);
    next(new Error('Not authorized, token invalid'));
  }
};

export const admin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  res.status(403);
  next(new Error('Admin access required'));
};
