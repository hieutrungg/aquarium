import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

// Bảo vệ route: yêu cầu đăng nhập
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer')) {
    token = header.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error('Chưa đăng nhập, vui lòng đăng nhập');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      res.status(401);
      throw new Error('Người dùng không tồn tại');
    }
    next();
  } catch (error) {
    res.status(401);
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }
});

// Giới hạn theo vai trò: authorize('admin', 'editor')
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Bạn không có quyền thực hiện hành động này');
    }
    next();
  };
