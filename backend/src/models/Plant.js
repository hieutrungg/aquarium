import mongoose from 'mongoose';

const plantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sciName: { type: String, trim: true },
    slug: { type: String, unique: true, index: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    light: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    co2: {
      type: String,
      enum: ['not_needed', 'optional', 'required'],
      default: 'optional',
    },
    growthRate: {
      type: String,
      enum: ['slow', 'medium', 'fast'],
      default: 'medium',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    position: {
      type: String,
      enum: ['foreground', 'midground', 'background', 'floating'],
      default: 'midground',
    },
    tags: [String],
  },
  { timestamps: true }
);

plantSchema.index({ name: 'text', sciName: 'text' });

const Plant = mongoose.model('Plant', plantSchema);
export default Plant;
