import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,20}$/ },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0.01 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    expiresAt: Date,
    usageLimit: { type: Number, min: 1 }, // undefined = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.pre('validate', function (next) {
  if (this.type === 'percent' && this.value > 100) this.invalidate('value', 'Percent discount cannot exceed 100');
  next();
});

export default mongoose.model('Coupon', couponSchema);
