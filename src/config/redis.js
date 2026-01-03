import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://gorgeous-perch-6209.upstash.io',
  token: 'ARhBAAImcDE4OWQ1ZWQxMTNlYmI0NzY4YmQ2NWNmOTcyZjRlNjBiOHAxNjIwOQ',
})

export default redis;