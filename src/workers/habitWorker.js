import { Worker } from 'bullmq';
import bullRedis from '../config/bullRedis.js';
import Habit from '../models/Habit.js';
 
const habitWorker = new Worker(
    'habit-jobs',
    async (job) => {
        if (job.name === 'reset-habit') {
            await Habit.findByIdAndUpdate(job.data.habitId, { todays_done: false });
        }
    },
    {
        connection: bullRedis,
        concurrency: 20,
    }
);
 
habitWorker.on('completed', (job) => {
    console.log(`✅ Habit reset: ${job.data.habitId}`);
});
 
habitWorker.on('failed', (job, err) => {
    console.error(`❌ Habit reset failed: ${job.data.habitId}`, err.message);
});
 
export default habitWorker;