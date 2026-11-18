import express from 'express';
import {
  getTanks,
  getTank,
  getTankScene,
  saveTankScene,
  createTank,
  updateTank,
  deleteTank,
  addLivestock,
  deleteLivestock,
  addTankPlant,
  deleteTankPlant,
  addHardscape,
  deleteHardscape,
  addWaterLog,
  addCareTask,
  completeCareTask,
  getLayoutSuggestion,
  generateLayoutImage,
} from '../controllers/tankController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Tất cả route hồ cá đều yêu cầu đăng nhập
router.use(protect);

router.route('/').get(getTanks).post(createTank);
router.route('/:id').get(getTank).put(updateTank).delete(deleteTank);
router.route('/:id/scene').get(getTankScene).put(saveTankScene);

// Cư dân
router.post('/:id/livestock', addLivestock);
router.delete('/:id/livestock/:itemId', deleteLivestock);

// Cây thủy sinh trong hồ
router.post('/:id/plants', addTankPlant);
router.delete('/:id/plants/:itemId', deleteTankPlant);

// Hệ sinh thái: nền, lũa, đá...
router.post('/:id/hardscape', addHardscape);
router.delete('/:id/hardscape/:itemId', deleteHardscape);

// Thông số nước
router.post('/:id/water-logs', addWaterLog);

// Lịch chăm sóc
router.post('/:id/care-tasks', addCareTask);
router.put('/:id/care-tasks/:taskId/complete', completeCareTask);

// Đề xuất layout + sinh ảnh
router.get('/:id/layout-suggestion', getLayoutSuggestion);
router.post('/:id/layout-image', generateLayoutImage);

export default router;
