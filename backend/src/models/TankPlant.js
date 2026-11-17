import mongoose from 'mongoose';

const tankPlantSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    position: {
      type: String,
      enum: ['foreground', 'midground', 'background', 'floating'],
      default: 'midground',
    },
  },
  { timestamps: true }
);

const TankPlant = mongoose.model('TankPlant', tankPlantSchema);
export default TankPlant;
