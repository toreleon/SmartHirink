import IORedis from 'ioredis';
import { loadEnv } from '../config.js';

let redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (!redis) {
    const env = loadEnv();
    redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}
