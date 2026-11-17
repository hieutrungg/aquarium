import mongoose from 'mongoose';

const rangeSchema = new mongoose.Schema(
  { min: Number, max: Number },
  { _id: false }
);

const speciesSchema = new mongoose.Schema(
  {
    commonName: { type: String, required: true, trim: true },
    sciName: { type: String, trim: true },
    slug: { type: String, unique: true, index: true },
    category: {
      type: String,
      enum: ['fish', 'shrimp', 'snail', 'other'],
      default: 'fish',
    },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    careLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    minTankSize: { type: Number, default: 0 }, // lít
    adultSize: { type: Number, default: 0 }, // cm
    tempRange: rangeSchema, // °C
    phRange: rangeSchema,
    temperament: {
      type: String,
      enum: ['peaceful', 'semi-aggressive', 'aggressive'],
      default: 'peaceful',
    },
    diet: {
      type: String,
      enum: ['herbivore', 'carnivore', 'omnivore'],
      default: 'omnivore',
    },
    // Gợi ý loài nuôi chung (tham chiếu tới Species khác)
    compatibleWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Species' }],
    tags: [String],
  },
  { timestamps: true }
);

speciesSchema.index({ commonName: 'text', sciName: 'text' });

const Species = mongoose.model('Species', speciesSchema);
export default Species;
