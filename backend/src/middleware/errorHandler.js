export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Không tìm thấy đường dẫn - ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Lỗi ObjectId không hợp lệ
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Không tìm thấy tài nguyên';
  }
  // Lỗi trùng key (email)
  if (err.code === 11000) {
    statusCode = 400;
    message = `Giá trị '${Object.keys(err.keyValue)}' đã tồn tại`;
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
