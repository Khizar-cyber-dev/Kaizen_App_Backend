class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Ye batata hai ke ye expected error hai

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;