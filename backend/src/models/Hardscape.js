import mongoose from 'mongoose';

// Hệ sinh thái phi sinh vật: nền, lũa, đá, trang trí...
const hardscapeSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['substrate', 'driftwood', 'rock', 'decoration', 'background'],
      required: true,
    },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

const Hardscape = mongoose.model('Hardscape', hardscapeSchema);
export default Hardscape;
