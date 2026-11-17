import mongoose from 'mongoose';

const waterLogSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    date: { type: Date, default: Date.now },
    temp: Number, // °C
    pH: Number,
    nh3: Number, // ppm (Ammonia)
    no2: Number, // ppm (Nitrite)
    no3: Number, // ppm (Nitrate)
    gh: Number, // dGH
    kh: Number, // dKH
    tds: Number, // ppm
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

waterLogSchema.index({ tankId: 1, date: -1 });

const WaterLog = mongoose.model('WaterLog', waterLogSchema);
export default WaterLog;
