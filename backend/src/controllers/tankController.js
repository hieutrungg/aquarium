import asyncHandler from 'express-async-handler';
import Tank from '../models/Tank.js';
import Livestock from '../models/Livestock.js';
import TankPlant from '../models/TankPlant.js';
import Hardscape from '../models/Hardscape.js';
import WaterLog from '../models/WaterLog.js';
import CareTask from '../models/CareTask.js';
import Plant from '../models/Plant.js';
import Species from '../models/Species.js';
import { suggestLayout, buildImagePrompt } from '../utils/layout.js';
import { generateImage, isGeminiConfigured } from '../utils/gemini.js';

// Đảm bảo hồ thuộc về user đang đăng nhập
const ownTankOr404 = async (tankId, userId, res) => {
  const tank = await Tank.findOne({ _id: tankId, userId });
  if (!tank) {
    res.status(404);
    throw new Error('Không tìm thấy hồ hoặc bạn không có quyền truy cập');
  }
  return tank;
};

// @route GET /api/tanks
export const getTanks = asyncHandler(async (req, res) => {
  const tanks = await Tank.find({ userId: req.user._id }).sort('-createdAt');
  res.json(tanks);
});

// @route GET /api/tanks/:id  (kèm cư dân, cây, hardscape, log, lịch chăm sóc)
export const getTank = asyncHandler(async (req, res) => {
  const tank = await ownTankOr404(req.params.id, req.user._id, res);
  const [livestock, plants, hardscape, waterLogs, careTasks] = await Promise.all([
    Livestock.find({ tankId: tank._id }),
    TankPlant.find({ tankId: tank._id }),
    Hardscape.find({ tankId: tank._id }),
    WaterLog.find({ tankId: tank._id }).sort('-date').limit(30),
    CareTask.find({ tankId: tank._id }).sort('nextDue'),
  ]);
  res.json({ tank, livestock, plants, hardscape, waterLogs, careTasks });
});

// @route POST /api/tanks
export const createTank = asyncHandler(async (req, res) => {
  const tank = await Tank.create({ ...req.body, userId: req.user._id });
  res.status(201).json(tank);
});

// @route PUT /api/tanks/:id  (sửa tên, loại, kích thước — tự tính lại lít)
export const updateTank = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const update = { ...req.body };

  // Nếu sửa kích thước mà không nhập lít thủ công -> tính lại volume
  if (update.dimensions && update.volume == null) {
    const { length, width, height } = update.dimensions;
    if (length && width && height) {
      update.volume = Math.round((length * width * height) / 1000);
    }
  }

  const tank = await Tank.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  res.json(tank);
});

// @route DELETE /api/tanks/:id
export const deleteTank = asyncHandler(async (req, res) => {
  const tank = await ownTankOr404(req.params.id, req.user._id, res);
  await Promise.all([
    Livestock.deleteMany({ tankId: tank._id }),
    TankPlant.deleteMany({ tankId: tank._id }),
    Hardscape.deleteMany({ tankId: tank._id }),
    WaterLog.deleteMany({ tankId: tank._id }),
    CareTask.deleteMany({ tankId: tank._id }),
    tank.deleteOne(),
  ]);
  res.json({ message: 'Đã xóa hồ' });
});

/* ---------- Cư dân (Livestock) ---------- */
export const addLivestock = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const item = await Livestock.create({ ...req.body, tankId: req.params.id });
  res.status(201).json(item);
});

export const deleteLivestock = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  await Livestock.findOneAndDelete({ _id: req.params.itemId, tankId: req.params.id });
  res.json({ message: 'Đã xóa cư dân' });
});

/* ---------- Cây thủy sinh trong hồ (TankPlant) ---------- */
export const addTankPlant = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const item = await TankPlant.create({ ...req.body, tankId: req.params.id });
  res.status(201).json(item);
});

export const deleteTankPlant = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  await TankPlant.findOneAndDelete({ _id: req.params.itemId, tankId: req.params.id });
  res.json({ message: 'Đã xóa cây' });
});

/* ---------- Hệ sinh thái: nền/lũa/đá... (Hardscape) ---------- */
export const addHardscape = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const item = await Hardscape.create({ ...req.body, tankId: req.params.id });
  res.status(201).json(item);
});

export const deleteHardscape = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  await Hardscape.findOneAndDelete({ _id: req.params.itemId, tankId: req.params.id });
  res.json({ message: 'Đã xóa vật liệu' });
});

/* ---------- Thông số nước (WaterLog) ---------- */
export const addWaterLog = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const log = await WaterLog.create({ ...req.body, tankId: req.params.id });
  res.status(201).json(log);
});

/* ---------- Lịch chăm sóc (CareTask) ---------- */
export const addCareTask = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const task = await CareTask.create({ ...req.body, tankId: req.params.id });
  res.status(201).json(task);
});

// Đánh dấu hoàn thành; nếu lặp lại thì dời nextDue
export const completeCareTask = asyncHandler(async (req, res) => {
  await ownTankOr404(req.params.id, req.user._id, res);
  const task = await CareTask.findOne({ _id: req.params.taskId, tankId: req.params.id });
  if (!task) {
    res.status(404);
    throw new Error('Không tìm thấy việc cần làm');
  }
  task.lastDone = new Date();
  if (task.repeatEvery > 0) {
    task.nextDue = new Date(Date.now() + task.repeatEvery * 86400000);
    task.done = false;
  } else {
    task.done = true;
  }
  await task.save();
  res.json(task);
});

/* ---------- Đề xuất layout cho hồ ---------- */
// @route GET /api/tanks/:id/layout-suggestion
export const getLayoutSuggestion = asyncHandler(async (req, res) => {
  const tank = await ownTankOr404(req.params.id, req.user._id, res);

  // Gợi ý cây thật từ thư viện + nội dung thật trong hồ của người dùng
  const [foreground, midground, background, fish, plants, hardscape, livestock] =
    await Promise.all([
      Plant.find({ position: 'foreground' }).limit(3),
      Plant.find({ position: 'midground' }).limit(3),
      Plant.find({ position: 'background' }).limit(3),
      Species.find({ temperament: 'peaceful', minTankSize: { $lte: tank.volume || 9999 } }).limit(4),
      TankPlant.find({ tankId: tank._id }),
      Hardscape.find({ tankId: tank._id }),
      Livestock.find({ tankId: tank._id }),
    ]);

  const suggestion = suggestLayout(
    tank,
    { foreground, midground, background, fish },
    { plants, hardscape, livestock }
  );
  suggestion.geminiReady = isGeminiConfigured();
  res.json(suggestion);
});

/* ---------- Sinh ảnh layout bằng Gemini ---------- */
// @route POST /api/tanks/:id/layout-image   body: { style?, notes? }
export const generateLayoutImage = asyncHandler(async (req, res) => {
  const tank = await ownTankOr404(req.params.id, req.user._id, res);

  if (!isGeminiConfigured()) {
    res.status(503);
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY. Thêm key vào backend/.env rồi khởi động lại server.'
    );
  }

  const [plants, hardscape, livestock] = await Promise.all([
    TankPlant.find({ tankId: tank._id }),
    Hardscape.find({ tankId: tank._id }),
    Livestock.find({ tankId: tank._id }),
  ]);

  const prompt = buildImagePrompt(tank, { plants, hardscape, livestock }, req.body || {});

  try {
    const { dataUrl } = await generateImage(prompt);
    res.json({ image: dataUrl, prompt });
  } catch (err) {
    res.status(err.statusCode || 502);
    throw err;
  }
});
