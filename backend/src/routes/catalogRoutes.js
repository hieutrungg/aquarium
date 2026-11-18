import express from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Species from '../models/Species.js';
import Plant from '../models/Plant.js';
import Tank from '../models/Tank.js';
import User from '../models/User.js';
import Livestock from '../models/Livestock.js';
import WaterLog from '../models/WaterLog.js';
import { buildCatalog } from '../utils/catalogFit.js';

const router = express.Router();

// Authentication is optional: invalid/expired credentials still receive the public catalog.
export async function loadCatalogContext(req) {
  if (typeof req.query.tankId !== 'string' || !mongoose.isObjectIdOrHexString(req.query.tankId)) return null;
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : req.cookies?.token;
  if (!token) return null;
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
  if (!mongoose.isObjectIdOrHexString(decoded.id)) return null;
  const user = await User.findById(decoded.id).select('_id').lean();
  if (!user) return null;
  const tank = await Tank.findOne({ _id: req.query.tankId, userId: user._id }).lean();
  if (!tank) return null;
  const [entries, water] = await Promise.all([
    Livestock.find({ tankId: tank._id }).populate('speciesId').lean(),
    WaterLog.findOne({ tankId: tank._id }).sort({ date: -1, _id: -1 }).lean(),
  ]);
  return { tank, water, livestock: entries.map((entry) => ({
    ...(entry.speciesId || {}), quantity: entry.quantity ?? 1,
  })) };
}

router.get('/', asyncHandler(async (req, res) => {
  const [species, plants, context] = await Promise.all([
    Species.find({ speciesKey: { $type: 'string', $ne: '' } }).sort('speciesKey').lean(),
    Plant.find({ plantKey: { $type: 'string', $ne: '' } }).sort('plantKey').lean(),
    loadCatalogContext(req),
  ]);
  res.json(buildCatalog(species, plants, context));
}));

export default router;
