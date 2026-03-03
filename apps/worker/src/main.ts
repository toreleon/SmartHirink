import pino from 'pino';
import { startEvaluationWorker, startTurnPersistWorker } from './evaluation-worker.js';
import { startReportWorker } from './report-worker.js';

const logger = pino({ name: 'worker-main' });

async function main(): Promise<void> {
  logger.info('Starting workers...');

  const evalWorker = startEvaluationWorker();
  const turnWorker = startTurnPersistWorker();
  const reportWorker = startReportWorker();

  logger.info('All workers started');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all([evalWorker.close(), turnWorker.close(), reportWorker.close()]);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker process crashed');
  process.exit(1);
});
