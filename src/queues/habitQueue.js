import { Queue } from 'bullmq';
import bullRedis from '../config/bullRedis.js';
 
export const habitQueue = new Queue('habit-jobs', {
    connection: bullRedis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 50,
        removeOnFail: 20,
    }
});
 