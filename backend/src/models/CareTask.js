import mongoose from 'mongoose';

const careTaskSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['water_change', 'feeding', 'fertilizer', 'cleaning', 'other'],
      default: 'other',
    },
    title: { type: String, required: true },
    // Lặp lại mỗi N ngày (0 = không lặp)
    repeatEvery: { type: Number, default: 0 },
    nextDue: { type: Date, required: true },
    lastDone: { type: Date },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const CareTask = mongoose.model('CareTask', careTaskSchema);
export default CareTask;
