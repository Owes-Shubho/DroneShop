import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    contactName: { type: String, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Supplier', supplierSchema);
