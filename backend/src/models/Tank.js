import mongoose from 'mongoose';

const equipmentSchema = new mongoose.Schema(
  {
    name: String,
    type: {
      type: String,
      enum: ['filter', 'light', 'co2', 'heater', 'other'],
      default: 'other',
    },
  },
  { _id: false }
);

const tankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: [true, 'Vui lòng nhập tên hồ'], trim: true },
    dimensions: {
      length: { type: Number, default: 0 }, // cm
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    // Dung tích (lít) - tự tính nếu không nhập
    volume: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['planted', 'freshwater', 'saltwater'],
      default: 'planted',
    },
    setupDate: { type: Date, default: Date.now },
    style: {
      type: String,
      enum: ['nature', 'iwagumi', 'dutch', 'biotope_amazon', 'biotope_asia', 'stream', 'paludarium', 'balcony_jar', 'foam_box', 'lowtech'],
      default: null,
    },
    shape: { type: String, enum: ['rect', 'jar'], default: 'rect' },
    scene: {
      props: { type: [mongoose.Schema.Types.Mixed], default: [] },
      camera: { x: { type: Number, default: 0 } },
    },
    lightSchedule: {
      on: { type: String, default: '08:00' },
      off: { type: String, default: '18:00' },
    },
    equipment: [equipmentSchema],
    coverImage: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// Tự tính dung tích từ kích thước (DxRxC cm -> lít) nếu chưa có
tankSchema.pre('save', function (next) {
  const { length, width, height } = this.dimensions || {};
  if (!this.volume && length && width && height) {
    this.volume = Math.round((length * width * height) / 1000);
  }
  next();
});

const Tank = mongoose.model('Tank', tankSchema);
export default Tank;
