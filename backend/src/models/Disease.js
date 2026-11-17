import mongoose from 'mongoose';

const diseaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    image: { type: String, default: '' },
    symptoms: [String],
    causes: [String],
    treatment: { type: String, default: '' },
    prevention: { type: String, default: '' },
  },
  { timestamps: true }
);

diseaseSchema.index({ name: 'text' });

const Disease = mongoose.model('Disease', diseaseSchema);
export default Disease;
