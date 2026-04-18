import { Queue, Worker } from 'bullmq';
import bullRedis from '../config/bullRedis.js';
import * as cronService from '../services/cronService.js';

const schedulerQueue = new Queue('scheduler', { connection: bullRedis });

/**
 * Register karo ek baar — app start pe.
 * Purane jobs hata ke fresh register karta hai.
 */
export const registerAllCrons = async () => {
    try {
        // Clean slate — duplicate jobs na banein
        const existing = await schedulerQueue.getRepeatableJobs();
        for (const job of existing) {
            await schedulerQueue.removeRepeatableByKey(job.key);
        }

        // ─── Register All Scheduled Jobs ─────────────────────────────────
        await schedulerQueue.add('goal-completion',
            {},
            { repeat: { pattern: '0 1 * * *' }, jobId: 'goal-completion' }
        ); // Every day 1:00 AM UTC

        await schedulerQueue.add('daily-reminders-8',
            {},
            { repeat: { pattern: '0 8 * * *' }, jobId: 'daily-reminders-8' }
        ); // Every day 8:00 AM UTC

        await schedulerQueue.add('daily-reminders-12',
            {},
            { repeat: { pattern: '0 12 * * *' }, jobId: 'daily-reminders-12' }
        ); // Every day 12:00 PM UTC

        await schedulerQueue.add('daily-reminders-20',
            {},
            { repeat: { pattern: '0 20 * * *' }, jobId: 'daily-reminders-20' }
        ); // Every day 8:00 PM UTC

        await schedulerQueue.add('missed-days',
            {},
            { repeat: { pattern: '0 23 * * *' }, jobId: 'missed-days' }
        ); // Every day 11:00 PM UTC

        await schedulerQueue.add('weekly-reviews',
            {},
            { repeat: { pattern: '0 9 * * 1' }, jobId: 'weekly-reviews' }
        ); // Every Monday 9:00 AM UTC

        await schedulerQueue.add('reset-daily-habits',
            {},
            { repeat: { pattern: '0 0 * * *' }, jobId: 'reset-daily-habits' }
        ); // Every day midnight UTC

        console.log('✅ All cron jobs registered in BullMQ scheduler');
    } catch (err) {
        console.error('❌ Failed to register cron jobs:', err.message);
        throw err;
    }
};

// ─── Worker — Scheduled Jobs Ko Process Karta Hai ────────────────────────────
new Worker(
    'scheduler',
    async (job) => {
        console.log(`⏰ [Scheduler] Running: ${job.name} at ${new Date().toISOString()}`);

        switch (job.name) {
            case 'goal-completion':
                return await cronService.checkGoalCompletion();

            case 'daily-reminders-8':
                return await cronService.sendDailyReminders('8');

            case 'daily-reminders-12':
                return await cronService.sendDailyReminders('12');

            case 'daily-reminders-20':
                return await cronService.sendDailyReminders('20');

            case 'missed-days':
                return await cronService.checkMissedDays();

            case 'weekly-reviews':
                return await cronService.sendWeeklyReviews();

            case 'reset-daily-habits':
                return await cronService.resetDailyHabits();

            default:
                console.warn(`⚠️ Unknown scheduled job: ${job.name}`);
        }
    },
    {
        connection: bullRedis,
        concurrency: 1, // Cron jobs ek ek karke chalein — overlap na ho
    }
);