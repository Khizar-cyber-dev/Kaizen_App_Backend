import { verifyToken } from "../lib/Token.js";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
    try {
        let accessToken = req.cookies?.accessToken;

        if (!accessToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            accessToken = req.headers.authorization.split(' ')[1];
        }

        if (!accessToken) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }
        const decoded = await verifyToken(accessToken, 'access');
        if (!decoded) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        req.user = user;
        await user.updateStreakOnAppOpen();
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
}