import { Router } from "express";
import { register, login, googleLogin, logout, refreshToken, sendOtp, verifyOtp, resetOtp, resetPassword, getProfile, updateSettings } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { otpRateLimiter, resetOtpRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Register a new user
router.post('/register', register);

// Login a user
router.post('/login', login);

// Login/register with Google directly through backend
router.post('/google', googleLogin);

// Logout a user
router.post('/logout', logout);

// Refresh a user's access token
router.post('/refresh', refreshToken);

// Send verification OTP
router.post('/send-verification-otp', authMiddleware, otpRateLimiter, sendOtp);

// Verify OTP
router.post('/verify-the-otp', authMiddleware, verifyOtp);

// Reset OTP
router.post('/reset-otp', resetOtpRateLimiter, resetOtp);

// Reset Password
router.post('/reset-password', resetPassword);

// Get user profile
router.get('/me', authMiddleware, getProfile);

// Update user settings
router.patch('/settings', authMiddleware, updateSettings);

export default router;
