import dotenv from 'dotenv'
import { Redis } from '@upstash/redis'

dotenv.config()

const redisUrl = process.env.REDIS_URL
const redisToken = process.env.REDIS_API

if (!redisUrl || !redisToken) {
  throw new Error('Missing REDIS_URL or REDIS_API environment variables')
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
})

export default redis;