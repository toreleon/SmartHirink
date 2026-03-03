import type { FastifyInstance } from 'fastify';
import { ModelConfigCreateSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';

export async function modelConfigRoutes(app: FastifyInstance) {
  // ─── List Model Configs ─────────────────────────────────
  app.get('/model-configs', { onRequest: [app.authenticate] }, async () => {
    return prisma.modelConfig.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // ─── Get Default Config ─────────────────────────────────
  app.get('/model-configs/default', { onRequest: [app.authenticate] }, async (req, reply) => {
    const config = await prisma.modelConfig.findFirst({ where: { isDefault: true } });
    if (!config) return reply.status(404).send({ error: 'No default config set' });
    return config;
  });

  // ─── Create Model Config (validated) ────────────────────
  app.post('/model-configs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { role: string };
    if (payload.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin only' });
    }

    const body = ModelConfigCreateSchema.parse(req.body);
    const config = await prisma.modelConfig.create({ data: body });
    return reply.status(201).send(config);
  });

  // ─── Update Model Config (validated) ────────────────────
  app.put('/model-configs/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { role: string };
    if (payload.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin only' });
    }

    const { id } = req.params as { id: string };
    const body = ModelConfigCreateSchema.partial().parse(req.body);

    // If setting as default, unset others
    if (body.isDefault) {
      await prisma.modelConfig.updateMany({ data: { isDefault: false } });
    }

    const config = await prisma.modelConfig.update({ where: { id }, data: body });
    return config;
  });
}
