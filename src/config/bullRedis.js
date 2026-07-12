import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const bullRedis = new Redis(process.env.UPSTASH_REDIS_IOREDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {}, // Upstash requires TLS
});

bullRedis.on('connect', () => console.log('BullMQ Redis connected'));
bullRedis.on('error', (err) => console.error('BullMQ Redis error:', err.message));

export default bullRedis;