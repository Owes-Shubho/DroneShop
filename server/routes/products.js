import { Router } from 'express';
import Product from '../models/Product.js';
import { protect, admin } from '../middleware/auth.js';

const router = Router();

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

router.post('/', protect, admin, async (req, res, next) => {
  try {
    res.status(201).json(await Product.create(req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const { reviews, rating, numReviews, ...data } = req.body;
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

export default router;
