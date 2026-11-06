import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';

// Atomically adds `delta` to a product's stock and returns the new level, or null when the product is
// missing or a removal would take stock below zero. Nothing is logged here; call record() once the
// surrounding operation has succeeded.
export async function changeStock(productId, delta) {
  const filter = delta < 0 ? { _id: productId, countInStock: { $gte: -delta } } : { _id: productId };
  const p = await Product.findOneAndUpdate(filter, { $inc: { countInStock: delta } }, { new: true }).select('countInStock sku name');
  return p ? { after: p.countInStock, sku: p.sku, name: p.name } : null;
}

// Writes movement rows. Each entry: { product, change, after, sku, name }. ctx: { reason, note, user, order, supplier, unitCost }.
export async function record(entries, ctx) {
  const rows = entries
    .filter((e) => e.change !== 0)
    .map((e) => ({
      product: e.product, sku: e.sku, name: e.name, change: e.change, after: e.after,
      reason: ctx.reason, note: ctx.note, user: ctx.user?._id, userName: ctx.user?.name,
      order: ctx.order, supplier: ctx.supplier, unitCost: ctx.unitCost,
    }));
  if (rows.length) await StockMovement.insertMany(rows);
}
