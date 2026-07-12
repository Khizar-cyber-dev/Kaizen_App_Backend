import { EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from "../lib/emailTemplate.js";
import transporter from "../config/nodeMailer.js";
import setCookies from "../lib/Cookies.js";
import { generateToken, getStoredRefreshToken, removeRefreshToken, storeRefreshToken, verifyToken } from "../lib/Token.js";
import User from "../models/User.js";
import AppError from "../lib/AppError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { OAuth2Client } from "google-auth-library";
import {
    sendWelcomeEmail
} from '../lib/emailService.js';

const googleClient = new OAuth2Client();

const getGoogleClientIds = () => {
    return [
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
    ]
        .map((clientId) => clientId?.trim())
        .filter(Boolean);
};

const toAuthUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    isAccountVerified: user.isAccountVerified,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    totalSessions: user.totalSessions,
    nextSessionNumber: user.nextSessionNumber,
    missingDays: user.missingDays,
    notificationsEnabled: user.notificationsEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    contributions: user.getContributions()
});

export const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        throw new AppError('Name, email and password are required', 400);
    }
    const userExits = await User.findOne({ email });
    if (userExits) {
        throw new AppError('User already exists', 400);
    }
    const user = await User.create({ name, email, password });
    user.lastActive = null;
    await user.updateStreakOnAppOpen();
    const { accessToken, refreshToken } = await generateToken(user._id);
    setCookies(res, accessToken, refreshToken);
    storeRefreshToken(user._id, refreshToken);

    user.password = undefined;

    try {
        // Send welcome coaching email using AI
        await sendWelcomeEmail(user);
    } catch (emailError) {
        console.error('Email sending failed:', emailError);
    }

    res.status(201).json({
        message: 'User registered successfully',
        user: { ...user.toObject(), contributions: user.getContributions() },
        accessToken,
        refreshToken
    });
});

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        throw new AppError('Email and password are required', 400);
    }
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('Invalid email or password', 400);
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        throw new AppError('Invalid email or password', 400);
    }

    // Update streak and activeDates on successful login
    await user.updateStreakOnAppOpen();

    const { accessToken, refreshToken } = await generateToken(user._id);
    setCookies(res, accessToken, refreshToken);
    storeRefreshToken(user._id, refreshToken);
    user.password = undefined;
    res.status(200).json({
        message: 'User logged in successfully',
        user: toAuthUser(user),
        accessToken: accessToken,
        refreshToken
    });
});

export const googleLogin = asyncHandler(async (req, res) => {
    const { idToken } = req.body || {};
    if (!idToken) {
        throw new AppError('Google idToken is required', 400);
    }

    const audience = getGoogleClientIds();
    if (!audience.length) {
        throw new AppError('Google OAuth client ID is not configured', 500);
    }

    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience,
    });

    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email;

    if (!googleId || !email || payload.email_verified === false) {
        throw new AppError('Google account could not be verified', 401);
    }

    const name = payload.name || payload.given_name || email.split('@')[0];
    let user = await User.findOne({ googleId });

    if (!user) {
        user = await User.findOne({ email });
        if (user) {
            user.googleId = googleId;
            user.authProvider = 'google';
            user.isAccountVerified = true;
            if (name && user.name !== name) user.name = name;
            await user.save();
        } else {
            user = await User.create({
                googleId,
                email,
                name,
                authProvider: 'google',
                isAccountVerified: true,
            });
        }
    } else {
        let updated = false;
        if (name && user.name !== name) {
            user.name = name;
            updated = true;
        }
        if (!user.isAccountVerified) {
            user.isAccountVerified = true;
            updated = true;
        }
        if (updated) await user.save();
    }

    await user.updateStreakOnAppOpen();

    const { accessToken, refreshToken } = await generateToken(user._id);
    setCookies(res, accessToken, refreshToken);
    await storeRefreshToken(user._id, refreshToken);

    res.status(200).json({
        message: 'Google login successful',
        user: toAuthUser(user),
        accessToken,
        refreshToken
    });
});

export const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
        return res.status(200).json({ message: 'Logged out successfully' });
    }
    const decoded = await verifyToken(refreshToken, 'refresh');
    if (!decoded) {
        throw new AppError('Invalid refresh token', 400);
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    await removeRefreshToken(decoded.id);
    res.status(200).json({ message: 'User logged out successfully' });
});

export const refreshToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
        throw new AppError('No refresh token found', 400);
    }
    const decoded = await verifyToken(refreshToken, 'refresh');
    if (!decoded) {
        throw new AppError('Invalid refresh token', 400);
    }
    const storedToken = await getStoredRefreshToken(decoded.id);
    if (storedToken !== refreshToken) {
        throw new AppError('Refresh token mismatch', 400);
    }
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateToken(decoded.id);
    setCookies(res, newAccessToken, newRefreshToken);
    await storeRefreshToken(decoded.id, newRefreshToken);
    res.status(200).json({ message: 'Token refreshed successfully', accessToken: newAccessToken, refreshToken: newRefreshToken });
});

export const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
        throw new AppError('User not found', 404);
    }
    res.status(200).json({
        userData: toAuthUser(user)
    });
});

export const sendOtp = asyncHandler(async (req, res) => {
    const userId = req?.user?._id;
    if (!userId) throw new AppError('userId is required', 400);
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    user.verifyOtp = otp;
    user.verifyOtpExpiry = otpExpiry;
    await user.save();
    try {
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Kizen Team!',
            html: EMAIL_VERIFY_TEMPLATE.replace('{{otp}}', otp).replace('{{email}}', user.email)
        };
        await transporter.sendMail(mailOptions);
    } catch (emailError) {
        console.error('Email sending failed:', emailError);
        throw new AppError('Failed to send OTP email', 500);
    }
    return res.status(200).json({ message: 'OTP sent successfully' });
});

export const verifyOtp = asyncHandler(async (req, res) => {
    const userId = req?.user?._id;
    const otp = req?.body?.otp;
    if (!userId) throw new AppError('userId is required', 400);
    if (!otp) throw new AppError('OTP is required', 400);
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    if (user.isAccountVerified) {
        throw new AppError('Account already verified', 400);
    }
    if (user.verifyOtp !== otp || user.verifyOtpExpiry < Date.now()) {
        throw new AppError('Invalid or expired OTP', 400);
    }
    user.isAccountVerified = true;
    user.verifyOtp = '';
    user.verifyOtpExpiry = 0;
    await user.save();
    res.status(200).json({
        message: 'Account verified successfully', data: {
            isAccountVerified: user.isAccountVerified,
        }
    });
});

export const resetOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('User not found', 404);
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    user.resetOtp = otp;
    user.resetOtpExpiry = otpExpiry;
    await user.save();
    try {
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Kizen Team - Password Reset OTP',
            html: PASSWORD_RESET_TEMPLATE.replace('{{email}}', user.email).replace('{{otp}}', otp)
        };
        await transporter.sendMail(mailOptions);
    } catch (emailError) {
        console.error('Email sending failed:', emailError);
        throw new AppError('Failed to send OTP email', 500);
    }
    return res.status(200).json({ message: 'Password reset OTP sent successfully' });
});

export const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        throw new AppError('Email, OTP and new password are required', 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (String(user.resetOtp) !== String(otp) || user.resetOtpExpiry < Date.now()) {
        throw new AppError('Invalid or expired OTP', 400);
    }

    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;

    await user.validate();
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
});

export const updateSettings = asyncHandler(async (req, res) => {
    const { notificationsEnabled } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    if (typeof notificationsEnabled !== 'undefined') {
        user.notificationsEnabled = notificationsEnabled;
    }

    await user.save();

    res.status(200).json({
        message: 'Settings updated successfully',
        user: toAuthUser(user)
    });
});
