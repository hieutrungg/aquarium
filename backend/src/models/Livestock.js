import mongoose from 'mongoose';

const livestockSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
      index: true,
    },
    speciesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Species' },
    // Lưu kèm tên để hiển thị nhanh kể cả khi loài bị xóa khỏi thư viện
    name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    addedDate: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

const Livestock = mongoose.model('Livestock', livestockSchema);
export default Livestock;
