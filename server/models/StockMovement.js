import mongoose from 'mongoose';

export const MOVEMENT_REASONS = ['initial', 'purchase', 'sale', 'cancellation', 'refund', 'damaged', 'correction', 'supplier-return', 'import'];

// One row per change to a product's stock, with the stock level afterwards. Rows are never edited.
const movementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: String,
    name: String, // snapshots, so the log still reads well after a product is renamed or deleted
    change: { type: Number, required: true }, // signed: +5 received, -1 sold
    after: { type: Number, required: true }, // stock level once the change was applied
    reason: { type: String, enum: MOVEMENT_REASONS, required: true, index: true },
    note: { type: String, maxlength: 500 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    unitCost: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
movementSchema.index({ createdAt: -1 });

export default mongoose.model('StockMovement', movementSchema);
