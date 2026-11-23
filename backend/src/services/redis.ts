import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected to Redis at ${env.REDIS_URL}`);
    });

    redisClient.on('error', (err) => {
      console.error(`[Redis] Connection error:`, err.message);
    });
  }

  return redisClient;
}

export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
