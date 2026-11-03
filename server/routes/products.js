import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

// Fields the server manages itself; admins cannot set them through the product form.
const clean = ({ reviews, rating, numReviews, _id, __v, createdAt, updatedAt, ...data }) => {
  if (Array.isArray(data.images)) data.images = data.images.filter((u) => typeof u === 'string' && u.trim()).slice(0, 8);
  return data;
};

// GET /api/products?search=&category=&minPrice=&maxPrice=&sort=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);

    const filter = {};
    if (search) filter.$text = { $search: search };
    if (category && category !== 'All') filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const sorts = {
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      rating: { rating: -1 },
      newest: { createdAt: -1 },
    };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .select('-reviews')
      .sort(sorts[sort] || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ products, page, pages: Math.ceil(total / limit), total });
  } catch (err) {
    next(err);
  }
});

router.get('/top', async (req, res, next) => {
  try {
    res.json(await Product.find().select('-reviews').sort({ rating: -1 }).limit(4));
  } catch (err) {
    next(err);
  }
});

// Several products by id, in the order requested (recently viewed, compare).
router.get('/by-ids', async (req, res, next) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter((i) => mongoose.isValidObjectId(i)).slice(0, 8);
    const found = await Product.find({ _id: { $in: ids } }).select('-reviews');
    res.json(ids.map((id) => found.find((p) => String(p._id) === id)).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/related', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.json([]);
    const product = await Product.findById(req.params.id).select('category brand');
    if (!product) return res.json([]);
    // Same category first, topped up with the same brand.
    const same = await Product.find({ _id: { $ne: product._id }, category: product.category }).select('-reviews').sort({ rating: -1 }).limit(4);
    if (same.length >= 4) return res.json(same);
    const more = await Product.find({ _id: { $nin: [product._id, ...same.map((p) => p._id)] }, brand: product.brand })
      .select('-reviews').sort({ rating: -1 }).limit(4 - same.length);
    res.json([...same, ...more]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

async function checkCategory(data, res) {
  if (data.category === undefined) return;
  if (!(await Category.exists({ name: String(data.category).trim() }))) {
    res.status(400);
    throw new Error('Unknown category. Add it under Categories first.');
  }
}

router.post('/', protect, admin, async (req, res, next) => {
  try {
    const data = clean(req.body);
    await checkCategory(data, res);
    res.status(201).json(await Product.create(data));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const data = clean(req.body);
    await checkCategory(data, res);
    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    res.json({ message: 'Product removed' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reviews', protect, async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
    if (product.reviews.some((r) => r.user.equals(req.user._id))) {
      res.status(400);
      throw new Error('You already reviewed this product');
    }
    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length;
    await product.save();
    res.status(201).json({ message: 'Review added' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/reviews/:reviewId', protect, admin, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    const review = product?.reviews.id(req.params.reviewId);
    if (!review) {
      res.status(404);
      throw new Error('Review not found');
    }
    review.deleteOne();
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length : 0;
    await product.save();
    res.json({ message: 'Review removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
