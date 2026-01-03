import redis from "../config/redis.js";

export const createRateLimiter = (maxRequests = 3, windowMs = 15 * 60 * 1000, keyPrefix = 'otp_rate_limit') => {
    return async (req, res, next) => {
        try {
            // Get identifier (user ID for authenticated routes, IP for public routes)
            const identifier = req.user?._id || req.ip || 'anonymous';
            const key = `${keyPrefix}:${identifier}`;

            // Get current count from Redis
            const currentCount = await redis.get(key);

            if (currentCount === null) {
                // First request in the window
                await redis.set(key, 1, { ex: Math.ceil(windowMs / 1000) });
                return next();
            }

            const count = parseInt(currentCount);

            if (count >= maxRequests) {
                // Rate limit exceeded
                const ttl = await redis.ttl(key);
                const remainingTime = Math.ceil(ttl / 60); // Convert to minutes

                return res.status(429).json({
                    message: `Too many OTP requests. Please try again in ${remainingTime} minutes.`,
                    retryAfter: ttl,
                    limit: maxRequests,
                    remaining: 0
                });
            }

            // Increment counter
            await redis.incr(key);

            // Calculate remaining requests
            const remaining = maxRequests - count - 1;

            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': new Date(Date.now() + (await redis.ttl(key)) * 1000).toISOString()
            });

            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            // If Redis fails, allow the request to proceed
            next();
        }
    };
};

/**
 * Rate limiter specifically for OTP sending (3 requests per 15 minutes)
 */
export const otpRateLimiter = createRateLimiter(3, 15 * 60 * 1000, 'otp_send');

/**
 * Rate limiter for password reset OTP (2 requests per 30 minutes)
 */
export const resetOtpRateLimiter = createRateLimiter(2, 30 * 60 * 1000, 'reset_otp');


/**
 * Rate limiter for starting Sessions (10 requests per 15 minutes)
 */
export const sessionRateLimiter = createRateLimiter(10, 15 * 60 * 1000, 'session_start');