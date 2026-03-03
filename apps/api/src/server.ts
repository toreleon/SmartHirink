import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { loadEnv } from './config.js';
import { authRoutes } from './routes/auth.js';
import { candidateRoutes } from './routes/candidates.js';
import { scenarioRoutes, rubricRoutes } from './routes/scenarios.js';
import { interviewRoutes } from './routes/interviews.js';
import { modelConfigRoutes } from './routes/model-config.js';
import { auditRoutes } from './routes/audit.js';

// ─── Extend Fastify types ─────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
  interface FastifyRequest {
    requestId: string;
  }
}

// ─── Metrics State ────────────────────────────────────────
const metrics = {
  startTime: Date.now(),
  requestCount: 0,
  activeConnections: 0,
};

async function main() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 1_048_576, // 1 MB
    genReqId: () => randomUUID(),
  });

  // ─── Plugins ──────────────────────────────────────────
  await app.register(cors, {
    origin: [env.APP_URL, 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Allow inline scripts for dev
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(cookie);

  await app.register(jwt, { secret: env.JWT_SECRET });

  // Serve reports directory for PDF downloads
  const reportsDir = process.env.REPORTS_DIR ?? path.resolve('./reports');
  await app.register(fastifyStatic, {
    root: reportsDir,
    prefix: '/reports/',
    decorateReply: false,
  });

  // ─── Auth Decorator ───────────────────────────────────
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ─── Request ID Correlation & Metrics ──────────────────
  app.addHook('onRequest', (req, _reply, done) => {
    metrics.requestCount++;
    metrics.activeConnections++;
    req.log.info({ reqId: req.id, method: req.method, url: req.url }, 'request start');
    done();
  });

  app.addHook('onResponse', (req, reply, done) => {
    metrics.activeConnections--;
    req.log.info(
      { reqId: req.id, method: req.method, url: req.url, statusCode: reply.statusCode, responseTime: reply.elapsedTime },
      'request complete',
    );
    done();
  });

  // ─── Health check ─────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ─── Metrics Endpoint ─────────────────────────────────
  app.get('/metrics', async () => ({
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    requestCount: metrics.requestCount,
    activeConnections: metrics.activeConnections,
    timestamp: new Date().toISOString(),
  }));

  // ─── Routes ───────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(candidateRoutes, { prefix: '/api' });
  await app.register(scenarioRoutes, { prefix: '/api' });
  await app.register(rubricRoutes, { prefix: '/api' });
  await app.register(interviewRoutes, { prefix: '/api' });
  await app.register(modelConfigRoutes, { prefix: '/api' });
  await app.register(auditRoutes, { prefix: '/api' });

  // ─── Global Error Handler ─────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation });
    }
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation failed', details: (error as any).issues });
    }
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: 'Too many requests. Please try again later.' });
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  // ─── Graceful Shutdown ─────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received shutdown signal, draining connections...');
    try {
      await app.close();
      app.log.info('Server closed gracefully');
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ─── Start ────────────────────────────────────────────
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`API server listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
