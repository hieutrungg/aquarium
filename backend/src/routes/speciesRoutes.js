import express from 'express';
import Species from '../models/Species.js';
import { crudFactory } from '../controllers/crudFactory.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const c = crudFactory(Species, { titleField: 'commonName' });

// Public đọc
router.get('/', c.list);
router.get('/:slug', c.getOne);

// Editor/Admin ghi
router.post('/', protect, authorize('editor', 'admin'), c.create);
router.put('/:id', protect, authorize('editor', 'admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

export default router;
