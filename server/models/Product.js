import mongoose from 'mongoose';
import crypto from 'crypto';

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, match: [SKU_PATTERN, 'SKU must be 2-40 characters: letters, numbers, . _ -'] }, // unique; generated when left blank
    brand: { type: String, required: true },
    modelNumber: { type: String, trim: true, maxlength: 60 },
    mpn: { type: String, trim: true, maxlength: 60 }, // manufacturer part number
    condition: { type: String, enum: ['New', 'Refurbished'], default: 'New' },
    warrantyMonths: { type: Number, min: 0, max: 120, default: 0 },
    costPrice: { type: Number, min: 0, select: false }, // purchase cost: staff only, never sent to shoppers
    attributes: { type: [{ _id: false, label: { type: String, trim: true, maxlength: 60 }, value: { type: String, trim: true, maxlength: 200 } }], default: [] }, // technical specs such as Motor KV or Battery capacity
    category: { type: String, required: true, trim: true }, // must match a Category name; checked in the product routes
    description: { type: String, required: true },
    image: { type: String, default: '' },
    images: { type: [String], default: [] }, // extra gallery images; `image` stays the main one
    price: { type: Number, required: true, min: 0 },
    countInStock: { type: Number, required: true, min: 0, default: 0 },
    specs: {
      flightTime: String,
      range: String,
      camera: String,
      weight: String,
    },
    reviews: [reviewSchema],
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });

// A readable unique SKU (brand prefix + random hex) for products created without one.
export async function generateSku(brand, Model) {
  const prefix = String(brand || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'SKU';
  for (;;) {
    const sku = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!(await Model.exists({ sku }))) return sku;
  }
}

productSchema.pre('validate', async function (next) {
  try {
    if (!this.sku) this.sku = await generateSku(this.brand, this.constructor);
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Product', productSchema);
