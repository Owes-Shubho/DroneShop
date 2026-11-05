import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    logo: { type: String, default: '', trim: true, maxlength: 300 }, // image URL or /path
    description: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export default mongoose.model('Brand', brandSchema);
