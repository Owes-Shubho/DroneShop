import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        image: String,
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true, default: 'Cash on Delivery' },
    coupon: { code: String, type: { type: String }, value: Number }, // `type` needs the explicit form or Mongoose reads it as the path's own type
    discountPrice: { type: Number, default: 0 },
    tracking: { carrier: String, number: String, url: String },
    shippedAt: Date,
    deliveredAt: Date,
    returnRequest: {
      reason: String,
      status: { type: String, enum: ['Requested', 'Approved', 'Rejected', 'Refunded'] },
      note: String, // admin's reply
      requestedAt: Date,
      resolvedAt: Date,
    },
    isRefunded: { type: Boolean, default: false },
    cancelledBy: { type: String, enum: ['customer', 'admin'] },
    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, required: true },
    taxPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    status: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
