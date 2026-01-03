import { Router } from "express";
import {
    startGeneralSession,
    pauseSession,
    closeSession,
    getSessionHistory,
    continueSession,
    getSessionById,
} from "../controllers/sessionController.js";
import { sessionRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Start a general focus session
router.post('/start', sessionRateLimiter, startGeneralSession);

// Pause/resume a session
router.put('/pause/:sessionId', pauseSession);

// Close/end a session
router.put('/close/:userId/:sessionId', closeSession);

// Get user's session history (today, week, month)
router.get('/history/:userId', getSessionHistory);

// Get direct session by ID
router.get('/:sessionId', getSessionById);

// Continue an abandoned session
router.post('/continue/:sessionId', continueSession);

export default router;