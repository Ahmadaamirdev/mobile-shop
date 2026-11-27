// Global Error Handler Middleware
const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err.message || err);

  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((el) => el.message);
    message = errors.join('. ');
  }

  // Handle Duplicate Key Errors
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate record: A device with this ${field} already exists.`;
  }

  // Handle Mongoose Cast Error (Invalid ObjectId) without reflecting raw input
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found.';
  }

  // Handle Transient MongoDB Connection / Timeout / Network Errors
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoTimeoutError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.message?.includes('buffering timed out') ||
    err.message?.includes('topology was closed') ||
    err.message?.includes('connection closed') ||
    err.message?.includes('socket hang up')
  ) {
    statusCode = 503;
    message = 'Database connection temporarily interrupted. Retrying operation...';
  }

  res.status(statusCode).json({
    success: false,
    message: isProd && statusCode === 500 ? 'Internal Server Error' : message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
