import type { FastifyInstance } from 'fastify';
import { ScenarioCreateSchema, RubricCreateSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';

export async function scenarioRoutes(app: FastifyInstance) {
  // ─── Create Scenario ────────────────────────────────────
  app.post('/scenarios', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = ScenarioCreateSchema.parse(req.body);
    const scenario = await prisma.scenario.create({
      data: { ...body, createdById: payload.sub },
    });

    await logAudit('CREATE_SCENARIO', 'Scenario', scenario.id, payload.sub);
    return reply.status(201).send(scenario);
  });

  // ─── List Scenarios ─────────────────────────────────────
  app.get('/scenarios', { onRequest: [app.authenticate] }, async (req) => {
    const { page = '1', limit = '20' } = req.query as { page?: string; limit?: string };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, items] = await Promise.all([
      prisma.scenario.count(),
      prisma.scenario.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { rubrics: { select: { id: true } } },
      }),
    ]);

    return { total, page: parseInt(page), limit: parseInt(limit), items };
  });

  // ─── Get Scenario ──────────────────────────────────────
  app.get('/scenarios/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const scenario = await prisma.scenario.findUnique({
      where: { id },
      include: { rubrics: { include: { criteria: true } } },
    });
    if (!scenario) return reply.status(404).send({ error: 'Not found' });
    return scenario;
  });

  // ─── Update Scenario ───────────────────────────────────
  app.put('/scenarios/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const body = ScenarioCreateSchema.partial().parse(req.body);
    const scenario = await prisma.scenario.update({ where: { id }, data: body });
    await logAudit('UPDATE_SCENARIO', 'Scenario', id, payload.sub);
    return scenario;
  });

  // ─── Delete Scenario ───────────────────────────────────
  app.delete('/scenarios/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin only' });
    }
    const { id } = req.params as { id: string };
    await prisma.scenario.delete({ where: { id } });
    await logAudit('DELETE_SCENARIO', 'Scenario', id, payload.sub);
    return reply.status(204).send();
  });
}

export async function rubricRoutes(app: FastifyInstance) {
  // ─── Create Rubric ─────────────────────────────────────
  app.post('/rubrics', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = RubricCreateSchema.parse(req.body);
    const rubric = await prisma.rubric.create({
      data: {
        scenarioId: body.scenarioId,
        criteria: {
          create: body.criteria,
        },
      },
      include: { criteria: true },
    });

    await logAudit('CREATE_RUBRIC', 'Rubric', rubric.id, payload.sub);
    return reply.status(201).send(rubric);
  });

  // ─── Get Rubric ────────────────────────────────────────
  app.get('/rubrics/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rubric = await prisma.rubric.findUnique({
      where: { id },
      include: { criteria: true },
    });
    if (!rubric) return reply.status(404).send({ error: 'Not found' });
    return rubric;
  });

  // ─── List Rubrics for Scenario ─────────────────────────
  app.get('/scenarios/:scenarioId/rubrics', { onRequest: [app.authenticate] }, async (req) => {
    const { scenarioId } = req.params as { scenarioId: string };
    return prisma.rubric.findMany({
      where: { scenarioId },
      include: { criteria: true },
      orderBy: { createdAt: 'desc' },
    });
  });
}
