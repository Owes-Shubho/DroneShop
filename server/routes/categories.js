import { Router } from 'express';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { protect, requires } from '../middleware/auth.js';

const router = Router();

const fail = (res, status, message) => {
  res.status(status);
  return new Error(message);
};
const nameOf = (body, res) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 40) throw fail(res, 400, 'Category name is required (40 characters max)');
  return name;
};
const duplicate = (err, res) => {
  if (err.code === 11000) return fail(res, 400, 'A category with that name already exists');
  return err;
};

// Databases created before categories were editable are filled in from the products on first read.
async function backfill() {
  if (await Category.estimatedDocumentCount()) return;
  const names = await Product.distinct('category');
  if (names.length) await Category.insertMany(names.map((name) => ({ name })), { ordered: false }).catch(() => {});
}

router.get('/', async (req, res, next) => {
  try {
    await backfill();
    const [cats, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json(cats.map((c) => ({ ...c, productCount: byName[c.name] || 0 })));
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, requires('products'), async (req, res, next) => {
  try {
    res.status(201).json(await Category.create({ name: nameOf(req.body, res) }));
  } catch (err) {
    next(duplicate(err, res));
  }
});

// Renaming also moves the category's products so none are left pointing at the old name.
router.put('/:id', protect, requires('products'), async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) throw fail(res, 404, 'Category not found');
    const name = nameOf(req.body, res);
    const old = cat.name;
    cat.name = name;
    await cat.save();
    if (old !== name) await Product.updateMany({ category: old }, { category: name });
    res.json(cat);
  } catch (err) {
    next(duplicate(err, res));
  }
});

router.delete('/:id', protect, requires('products'), async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) throw fail(res, 404, 'Category not found');
    const used = await Product.countDocuments({ category: cat.name });
    if (used) throw fail(res, 400, `${used} product${used === 1 ? ' still uses' : 's still use'} this category. Move or delete them first.`);
    await cat.deleteOne();
    res.json({ message: 'Category removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
