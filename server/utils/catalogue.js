import Product from '../models/Product.js';
import Brand from '../models/Brand.js';

// Brings older data up to date: a Brand for every brand name in use and a SKU for every product.
// Safe to run repeatedly; returns what it changed.
export async function backfillCatalogue() {
  const names = await Product.distinct('brand');
  const seen = new Set((await Brand.find().select('name')).map((b) => b.name.toLowerCase()));
  const fresh = [];
  for (const name of names) {
    const n = String(name || '').trim();
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      fresh.push({ name: n });
    }
  }
  if (fresh.length) await Brand.insertMany(fresh, { ordered: false }).catch(() => {});

  let skus = 0;
  for (const p of await Product.find({ $or: [{ sku: { $exists: false } }, { sku: null }, { sku: '' }] })) {
    await p.save(); // the model assigns the SKU
    skus++;
  }
  return { brands: fresh.length, skus };
}
