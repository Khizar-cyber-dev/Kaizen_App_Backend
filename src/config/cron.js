import cron from 'node-cron';
import * as cronService from '../services/cronService.js';

const cronTimezone = process.env.CRON_TIMEZONE || 'UTC';
const cronOptions = { timezone: cronTimezone };

// Run at midnight to check goal completion and reset daily habits
cron.schedule('0 0 * * *', async () => {
    try {
        await cronService.checkGoalCompletion();
    } catch (error) {
        console.error('Error in goal completion check cron:', error);
    }

    try {
        await cronService.resetDailyHabits();
    } catch (err) {
        console.error('Error in daily reset cron:', err);
    }
}, cronOptions);

// Daily reminders (8am, 12pm, 8pm)
cron.schedule('0 8,12,20 * * *', async () => {
    try {
        const currentHour = new Date().getHours().toString();
        await cronService.sendDailyReminders(currentHour);
    } catch (error) {
        console.error('Error in daily reminder job cron:', error);
    }
}, cronOptions);

// Check for missed days/habits at 11:55 PM
cron.schedule('55 23 * * *', async () => {
    try {
        await cronService.checkMissedDays();
    } catch (error) {
        console.error('Error in missed day check cron:', error);
    }
}, cronOptions);

// Weekly reviews every Monday at 9:00 AM
cron.schedule('0 9 * * 1', async () => {
    try {
        await cronService.sendWeeklyReviews();
    } catch (error) {
        console.error('Error in weekly review job cron:', error);
    }
}, cronOptions);
