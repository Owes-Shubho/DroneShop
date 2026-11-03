import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { can, permissionsOf } from '../utils/permissions.js';

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
  } catch (err) {
    res.status(401);
    return next(new Error('Not authorized, token invalid'));
  }
  if (req.user.disabled) {
    res.status(401);
    return next(new Error('This account has been suspended'));
  }
  next();
};

// Any role with dashboard permissions (support, manager, admin).
export const staff = (req, res, next) => {
  if (permissionsOf(req.user).length) return next();
  res.status(403);
  next(new Error('Staff access required'));
};

// Allows the request only when the user's role grants `permission`.
export const requires = (permission) => (req, res, next) => {
  if (can(req.user, permission)) return next();
  res.status(403);
  next(new Error('You do not have permission to do that'));
};

// Full admins only.
export const admin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  res.status(403);
  next(new Error('Admin access required'));
};
