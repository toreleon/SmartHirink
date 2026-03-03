import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { loadEnv } from './config.js';
import { authRoutes } from './routes/auth.js';
import { candidateRoutes } from './routes/candidates.js';
import { scenarioRoutes, rubricRoutes } from './routes/scenarios.js';
import { interviewRoutes } from './routes/interviews.js';
import { modelConfigRoutes } from './routes/model-config.js';

// ─── Extend Fastify types ─────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}

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
  });

  // ─── Plugins ──────────────────────────────────────────
  await app.register(cors, {
    origin: [env.APP_URL, 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(jwt, { secret: env.JWT_SECRET });

  // ─── Auth Decorator ───────────────────────────────────
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ─── Health check ─────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ─── Routes ───────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(candidateRoutes, { prefix: '/api' });
  await app.register(scenarioRoutes, { prefix: '/api' });
  await app.register(rubricRoutes, { prefix: '/api' });
  await app.register(interviewRoutes, { prefix: '/api' });
  await app.register(modelConfigRoutes, { prefix: '/api' });

  // ─── Global Error Handler ─────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation });
    }
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation failed', details: (error as any).issues });
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  // ─── Start ────────────────────────────────────────────
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`API server listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
