import mongoose from 'mongoose';

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
    brand: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Camera Drones', 'Racing Drones', 'Toy Drones', 'Industrial Drones', 'Accessories'],
    },
    description: { type: String, required: true },
    image: { type: String, default: '' },
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

export default mongoose.model('Product', productSchema);
