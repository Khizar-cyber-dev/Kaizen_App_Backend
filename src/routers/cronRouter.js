import express from 'express';
import * as cronService from '../services/cronService.js';

const router = express.Router();

const logCronRequest = (req) => {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    const maskedSecret = secret
        ? `${String(secret).slice(0, 2)}***${String(secret).slice(-2)}`
        : 'none';

    console.log(
        `[CRON] Incoming request | time=${new Date().toISOString()} | task=${req.query.task || 'none'} | ip=${req.ip} | ua="${req.get('user-agent') || 'unknown'}" | hasSecret=${secret ? 'yes' : 'no'} | secretPreview=${maskedSecret}`
    );
};

const attachCronResponseLogger = (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(
            `[CRON] Completed request | time=${new Date().toISOString()} | task=${req.query.task || 'none'} | status=${res.statusCode} | durationMs=${durationMs} | ip=${req.ip}`
        );
    });
    next();
};

// Middleware to check for CRON_SECRET
const verifyCronSecret = (req, res, next) => {
    logCronRequest(req);

    const secret = req.headers['x-cron-secret'] || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('CRON_SECRET is not defined in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (secret !== expectedSecret) {
        console.warn(`Unauthorized cron access attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};


router.get('/run-task', attachCronResponseLogger, verifyCronSecret, async (req, res) => {
    const { task } = req.query;

    try {
        let result;
        switch (task) {
            case 'goal-completion':
                result = await cronService.checkGoalCompletion();
                break;
            case 'daily-reminders-8':
                result = await cronService.sendDailyReminders('8');
                break;
            case 'daily-reminders-12':
                result = await cronService.sendDailyReminders('12');
                break;
            case 'daily-reminders-20':
                result = await cronService.sendDailyReminders('20');
                break;
            case 'missed-days':
                result = await cronService.checkMissedDays();
                break;
            case 'weekly-reviews':
                result = await cronService.sendWeeklyReviews();
                break;
            case 'reset-daily-habits':
                result = await cronService.resetDailyHabits();
                break;
            default:
                return res.status(400).json({ error: 'Invalid task name' });
        }

        res.json({ message: `Task ${task} executed successfully`, result });
    } catch (error) {
        console.error(`Error executing task ${task}:`, error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
