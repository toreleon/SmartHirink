import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { startEvaluationWorker, startTurnPersistWorker } from './evaluation-worker.js';
import { startReportWorker } from './report-worker.js';

const logger = pino({ name: 'worker-main' });

const DRAIN_TIMEOUT_MS = 10_000; // 10 seconds for graceful drain

async function healthCheck(): Promise<void> {
  logger.info('Running startup health checks...');

  // Check Redis connectivity
  const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
  });
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Redis ping returned: ${pong}`);
    }
    logger.info('Redis: OK');
  } catch (err) {
    logger.fatal({ err }, 'Redis health check failed');
    throw new Error('Redis is not available');
  } finally {
    redis.disconnect();
  }

  // Check PostgreSQL connectivity
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL: OK');
  } catch (err) {
    logger.fatal({ err }, 'PostgreSQL health check failed');
    throw new Error('PostgreSQL is not available');
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  // Run health checks before starting workers
  await healthCheck();

  logger.info('Starting workers...');

  const evalWorker = startEvaluationWorker();
  const turnWorker = startTurnPersistWorker();
  const reportWorker = startReportWorker();

  logger.info('All workers started');

  // Graceful shutdown with drain timeout
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Shutting down workers (draining jobs)...');

    // Set a hard timeout for shutdown
    const forceExit = setTimeout(() => {
      logger.warn('Drain timeout exceeded, forcing exit');
      process.exit(1);
    }, DRAIN_TIMEOUT_MS);

    try {
      await Promise.all([
        evalWorker.close(),
        turnWorker.close(),
        reportWorker.close(),
      ]);
      logger.info('All workers drained and closed');
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
    }

    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker process crashed');
  process.exit(1);
});
