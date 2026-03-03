import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { loadEnv } from '../config.js';

const env = loadEnv();

// Create a Redis connection for BullMQ
// Note: We use 'as any' to bypass type incompatibility between ioredis versions
const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
}) as any;

export const evaluationQueue = new Queue('evaluation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const reportQueue = new Queue('report', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export interface EvaluationJobData {
  sessionId: string;
}

export interface ReportJobData {
  sessionId: string;
  scoreCardId: string;
}
