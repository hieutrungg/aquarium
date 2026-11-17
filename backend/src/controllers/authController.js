import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { generateToken } from '../utils/token.js';

const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
});

// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Vui lòng điền đầy đủ thông tin');
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('Email đã được đăng ký');
  }

  const user = await User.create({ name, email, password });
  res.status(201).json({ ...sanitize(user), token: generateToken(user._id) });
});

// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  if (user && (await user.matchPassword(password))) {
    res.json({ ...sanitize(user), token: generateToken(user._id) });
  } else {
    res.status(401);
    throw new Error('Email hoặc mật khẩu không đúng');
  }
});

// @route   GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  res.json(sanitize(req.user));
});
