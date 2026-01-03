import jwt from 'jsonwebtoken';
import redis from '../config/redis.js'

export const generateToken = async (id) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });

  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

export const verifyToken = (token, type = 'access') => {
  try {
    const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
    return jwt.verify(token, secret);
  } catch (err) {
    console.log(err)
  }
}


export const storeRefreshToken = async (userId, refreshToken) => {
  try {
    await redis.set(`refresh_token:${userId}`, refreshToken, {
      ex: 7 * 24 * 60 * 60, // 7 days
    });
  } catch (err) {
    console.error("Redis store error:", err);
    throw err;
  }
};

export const getStoredRefreshToken = async (userId) => {
  try {
    return await redis.get(`refresh_token:${userId}`);
  } catch (err) {
    console.error("Redis get error:", err);
    throw err;
  }
}


export const removeRefreshToken = async (userId) => {
  try {
    await redis.del(`refresh_token:${userId}`);
  } catch (err) {
    console.error("Redis delete error:", err);
    throw err;
  }
};