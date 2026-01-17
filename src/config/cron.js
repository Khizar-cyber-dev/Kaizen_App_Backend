import cron from 'node-cron';
import * as cronService from '../services/cronService.js';

// Run at midnight to check goal completion and send emails for failed goals
cron.schedule('0 0 * * *', async () => {
    try {
        await cronService.checkGoalCompletion();
    } catch (error) {
        console.error('Error in goal completion check cron:', error);
    }
});

// 🔔 Daily reminders (8am, 12pm, 8pm) - send email with incomplete habits
cron.schedule("0 8,12,20 * * *", async () => {
    try {
        const currentHour = new Date().getHours().toString();
        await cronService.sendDailyReminders(currentHour);
    } catch (error) {
        console.error('Error in daily reminder job cron:', error);
    }
});

// Check for missed days/habits at 11:55 PM (before midnight)
cron.schedule("55 23 * * *", async () => {
    try {
        await cronService.checkMissedDays();
    } catch (error) {
        console.error('Error in missed day check cron:', error);
    }
});

cron.schedule("0 9 * * 1", async () => {
    try {
        await cronService.sendWeeklyReviews();
    } catch (error) {
        console.error('Error in weekly review job cron:', error);
    }
});

// Run every day at 00:00 UTC to reset todays_done for all habits
cron.schedule('0 0 * * *', async () => {
    try {
        await cronService.resetDailyHabits();
    } catch (err) {
        console.error('Error in daily reset cron:', err);
    }
});