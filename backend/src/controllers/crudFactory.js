import asyncHandler from 'express-async-handler';
import { slugify } from '../utils/token.js';

// Tạo bộ controller CRUD chuẩn cho 1 Model thư viện (public đọc, editor/admin ghi)
export const crudFactory = (Model, { titleField = 'name' } = {}) => ({
  // GET /  - hỗ trợ ?q= tìm kiếm, ?page=&limit= phân trang, lọc theo field
  list: asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 12, ...filters } = req.query;
    const query = {};

    if (q) query.$text = { $search: q };
    // Cho phép lọc trực tiếp theo các field enum (difficulty, category, ...)
    Object.entries(filters).forEach(([key, val]) => {
      if (val) query[key] = val;
    });

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Model.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
      Model.countDocuments(query),
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / limit) });
  }),

  // GET /:slug
  getOne: asyncHandler(async (req, res) => {
    const item = await Model.findOne({ slug: req.params.slug });
    if (!item) {
      res.status(404);
      throw new Error('Không tìm thấy nội dung');
    }
    res.json(item);
  }),

  // POST /  (editor/admin)
  create: asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (!data.slug && data[titleField]) {
      data.slug = `${slugify(data[titleField])}-${Date.now().toString(36)}`;
    }
    const item = await Model.create(data);
    res.status(201).json(item);
  }),

  // PUT /:id  (editor/admin)
  update: asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      res.status(404);
      throw new Error('Không tìm thấy nội dung');
    }
    res.json(item);
  }),

  // DELETE /:id  (admin)
  remove: asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Không tìm thấy nội dung');
    }
    res.json({ message: 'Đã xóa' });
  }),
});
