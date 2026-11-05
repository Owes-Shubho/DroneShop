import { Router } from 'express';
import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import { protect, requires } from '../middleware/auth.js';
import { backfillCatalogue } from '../utils/catalogue.js';

const router = Router();

const fail = (res, status, message) => {
  res.status(status);
  return new Error(message);
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const caseInsensitive = (name) => new RegExp(`^${escapeRe(name)}$`, 'i');

function fields(body, res) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) throw fail(res, 400, 'Brand name is required (60 characters max)');
  const logo = typeof body.logo === 'string' ? body.logo.trim() : '';
  if (logo && !/^(https?:\/\/|\/)/i.test(logo)) throw fail(res, 400, 'Logo must be an image URL or a path starting with /');
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length > 500) throw fail(res, 400, 'Description can be up to 500 characters');
  return { name, logo, description };
}

async function assertUnique(name, res, exceptId) {
  const other = await Brand.findOne({ name: caseInsensitive(name), ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (other) throw fail(res, 400, 'A brand with that name already exists');
}

router.get('/', async (req, res, next) => {
  try {
    if (!(await Brand.estimatedDocumentCount())) await backfillCatalogue(); // databases from before brands existed
    const [brands, counts] = await Promise.all([
      Brand.find().sort({ name: 1 }).collation({ locale: 'en' }).lean(),
      Product.aggregate([{ $group: { _id: '$brand', count: { $sum: 1 } } }]),
    ]);
    const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json(brands.map((b) => ({ ...b, productCount: byName[b.name] || 0 })));
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, requires('products'), async (req, res, next) => {
  try {
    const data = fields(req.body, res);
    await assertUnique(data.name, res);
    res.status(201).json(await Brand.create(data));
  } catch (err) {
    next(err);
  }
});

// Renaming also moves the brand's products so none are left pointing at the old name.
router.put('/:id', protect, requires('products'), async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) throw fail(res, 404, 'Brand not found');
    const data = fields(req.body, res);
    await assertUnique(data.name, res, brand._id);
    const old = brand.name;
    brand.set(data);
    await brand.save();
    if (old !== brand.name) await Product.updateMany({ brand: old }, { brand: brand.name });
    res.json(brand);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, requires('products'), async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) throw fail(res, 404, 'Brand not found');
    const used = await Product.countDocuments({ brand: brand.name });
    if (used) throw fail(res, 400, `${used} product${used === 1 ? ' still uses' : 's still use'} this brand. Move or delete them first.`);
    await brand.deleteOne();
    res.json({ message: 'Brand removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
