import { Queue } from 'bullmq';
import bullRedis from '../config/bullRedis.js';

export const emailQueue = new Queue('email-jobs', {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});