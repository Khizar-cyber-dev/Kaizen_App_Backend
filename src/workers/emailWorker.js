import { Worker } from 'bullmq';
import bullRedis from '../config/bullRedis.js';
import {
    sendGoalFailureEmail,
    sendDailyReminderEmail,
    sendMissedDayEmail,
    sendWeeklyReviewEmail,
    sendStreakMilestoneEmail,
} from '../lib/emailService.js';
 
const emailWorker = new Worker(
    'email-jobs',
    async (job) => {
        const { type, user, data } = job.data;
 
        switch (type) {
            case 'daily-reminder':
                return await sendDailyReminderEmail(user, data.incompleteHabits, data.hour);
 
            case 'missed-day':
                return await sendMissedDayEmail(user, data.missedHabits);
 
            case 'weekly-review':
                return await sendWeeklyReviewEmail(user, data.habits, data.sessions, data.stats);
 
            case 'goal-failure':
                return await sendGoalFailureEmail(user, data.goals);
 
            case 'streak-milestone':
                return await sendStreakMilestoneEmail(user, data.milestone);
 
            default:
                throw new Error(`Unknown email job type: ${type}`);
        }
    },
    {
        connection: bullRedis,
        concurrency: 5, // SMTP rate limit ke sath balance
    }
);
 
emailWorker.on('completed', (job) => {
    console.log(`✅ Email sent | type=${job.data.type} | to=${job.data.user?.email}`);
});
 
emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email failed | type=${job.data.type} | to=${job.data.user?.email} | err=${err.message}`);
});
 
export default emailWorker;
 