import AppError from "../lib/AppError.js";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function normalizeError(err) {
  const normalized = err instanceof Error ? err : new Error(String(err));

  if (!normalized.statusCode) normalized.statusCode = 500;
  if (!normalized.status) {
    normalized.status = `${normalized.statusCode}`.startsWith("4") ? "fail" : "error";
  }

  return normalized;
}

function handleMongooseCastError(err) {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

function handleMongooseValidationError(err) {
  const message = Object.values(err.errors || {})
    .map((e) => e?.message)
    .filter(Boolean)
    .join(". ");

  return new AppError(message || "Invalid input data", 400);
}

function handleMongoDuplicateKey(err) {
  const field = err.keyValue ? Object.keys(err.keyValue)[0] : "field";
  const value = err.keyValue ? err.keyValue[field] : undefined;
  const message = value ? `${field} '${value}' already exists` : "Duplicate field value";
  return new AppError(message, 409);
}

function handleJwtError(err) {
  if (err.name === "JsonWebTokenError") {
   return new AppError("Invalid token", 401);
  }

  if (err.name === "TokenExpiredError") {
    return new AppError("Token expired", 401);
  }
}

export const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    message: err.message,
    error: {
      name: err.name,
      status: err.status,
      statusCode: err.statusCode,
    },
    stack: err.stack,
  });
};

export const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      message: err.message,
    });
    return;
  }

  console.error("ERROR 💥", err);
  res.status(500).json({
    message: "Something went wrong!",
  });
};

export const notFound = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const errorHandler = (err, _req, res, _next) => {
  let error = normalizeError(err);

  if (error.name === "CastError") error = handleMongooseCastError(error);
  if (error.name === "ValidationError") error = handleMongooseValidationError(error);
  if (error.code === 11000) error = handleMongoDuplicateKey(error);
  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    error = handleJwtError(error);
  }

  if (!error.statusCode) error.statusCode = 500;
  if (!error.status) error.status = `${error.statusCode}`.startsWith("4") ? "fail" : "error";

  if (isProd()) return sendErrorProd(error, res);
  return sendErrorDev(error, res);
};
