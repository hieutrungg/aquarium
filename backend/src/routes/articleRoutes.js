import express from 'express';
import Article from '../models/Article.js';
import { crudFactory } from '../controllers/crudFactory.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const c = crudFactory(Article, { titleField: 'title' });

router.get('/', c.list);
router.get('/:slug', c.getOne);

router.post('/', protect, authorize('editor', 'admin'), c.create);
router.put('/:id', protect, authorize('editor', 'admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

export default router;
