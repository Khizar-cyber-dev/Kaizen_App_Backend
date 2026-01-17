import { EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from "../lib/emailTemplate.js";
import transporter from "../config/nodeMailer.js";
import setCookies from "../lib/Cookies.js";
import { generateToken, getStoredRefreshToken, removeRefreshToken, storeRefreshToken, verifyToken } from "../lib/Token.js";
import User from "../models/User.js";
import {
    sendWelcomeEmail
} from '../lib/emailService.js';

export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }
        const userExits = await User.findOne({ email });
        if (userExits) {
            return res.status(400).json({ message: 'User already exists' });
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Update streak and activeDates on successful login
        await user.updateStreakOnAppOpen();

        const { accessToken, refreshToken } = await generateToken(user._id);
        setCookies(res, accessToken, refreshToken);
        storeRefreshToken(user._id, refreshToken);
        user.password = undefined;
        res.status(200).json({
            message: 'User logged in successfully',
            user: {
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
            },
            accessToken: accessToken,
            refreshToken
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(200).json({ message: 'Logged out successfully' });
        }
        const decoded = await verifyToken(refreshToken, 'refresh');
        if (!decoded) {
            return res.status(400).json({ message: 'Invalid refresh token' });
        }
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        await removeRefreshToken(decoded.id);
        res.status(200).json({ message: 'User logged out successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ message: 'No refresh token found' });
        }
        const decoded = await verifyToken(refreshToken, 'refresh');
        if (!decoded) {
            return res.status(400).json({ message: 'Invalid refresh token' });
        }
        const storedToken = await getStoredRefreshToken(decoded.id);
        if (storedToken !== refreshToken) {
            return res.status(400).json({ message: 'Refresh token mismatch' });
        }
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateToken(decoded.id);
        setCookies(res, newAccessToken, newRefreshToken);
        await storeRefreshToken(decoded.id, newRefreshToken);
        res.status(200).json({ message: 'Token refreshed successfully', accessToken: newAccessToken, refreshToken: newRefreshToken });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({
            userData: {
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
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const sendOtp = async (req, res) => {
    try {
        const userId = req?.user?._id;
        if (!userId) return res.status(400).json({ message: 'userId is required' });
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
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
            return res.status(500).json({ message: 'Failed to send OTP email' });
        }
        return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const verifyOtp = async (req, res) => {
    try {
        const userId = req?.user?._id;
        const otp = req?.body?.otp;
        if (!userId) return res.status(400).json({ message: 'userId is required' });
        if (!otp) return res.status(400).json({ message: 'OTP is required' });
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.isAccountVerified) {
            return res.status(400).json({ message: 'Account already verified' });
        }
        if (user.verifyOtp !== otp || user.verifyOtpExpiry < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const resetOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
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
            return res.status(500).json({ message: 'Failed to send OTP email' });
        }
        return res.status(200).json({ message: 'Password reset OTP sent successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP and new password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (String(user.resetOtp) !== String(otp) || user.resetOtpExpiry < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        user.password = newPassword;
        user.resetOtp = undefined;
        user.resetOtpExpiry = undefined;

        await user.validate();
        await user.save();

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
}

export const syncClerkUser = async (req, res) => {
    try {
        const { clerkId, email, name } = req.body;

        if (!clerkId || !email) {
            return res.status(400).json({ message: 'clerkId and email are required' });
        }

        let user = await User.findOne({ clerkId });

        if (!user) {
            user = await User.findOne({ email });
            if (user) {
                user.clerkId = clerkId;
                if (name) user.name = name;
                await user.save();
            } else {
                user = await User.create({
                    clerkId,
                    email,
                    name: name || email.split('@')[0],
                    isAccountVerified: false,
                });
                await user.updateStreakOnAppOpen();
            }
        } else {
            let updated = false;
            if (name && user.name !== name) {
                user.name = name;
                updated = true;
            }
            if (updated) await user.save();

            // Update streak and activeDates on returning sync
            await user.updateStreakOnAppOpen();
        }

        const { accessToken, refreshToken } = await generateToken(user._id);
        setCookies(res, accessToken, refreshToken);
        storeRefreshToken(user._id, refreshToken);

        res.status(200).json({
            message: 'User synced successfully',
            user: {
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
            },
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('Sync Clerk User Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
}
export const updateSettings = async (req, res) => {
    try {
        const { notificationsEnabled } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (typeof notificationsEnabled !== 'undefined') {
            user.notificationsEnabled = notificationsEnabled;
        }

        await user.save();

        res.status(200).json({
            message: 'Settings updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isAccountVerified: user.isAccountVerified,
                notificationsEnabled: user.notificationsEnabled,
                currentStreak: user.currentStreak,
                longestStreak: user.longestStreak,
                totalSessions: user.totalSessions,
                nextSessionNumber: user.nextSessionNumber,
                missingDays: user.missingDays,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                contributions: user.getContributions()
            }
        });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
};
