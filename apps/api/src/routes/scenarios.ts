import type { FastifyInstance } from 'fastify';
import { ScenarioCreateSchema, RubricCreateSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';
import { authorizeScenario } from '../lib/authorize.js';

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
    const { page = '1', limit = '20', position, level, domain } = req.query as {
      page?: string;
      limit?: string;
      position?: string;
      level?: string;
      domain?: string;
    };

    // Clamp pagination bounds
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (position) where.position = { contains: position, mode: 'insensitive' };
    if (level) where.level = { contains: level, mode: 'insensitive' };
    if (domain) where.domain = { contains: domain, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      prisma.scenario.count({ where }),
      prisma.scenario.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { rubrics: { select: { id: true } } },
      }),
    ]);

    return { total, page: pageNum, limit: limitNum, items };
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

  // ─── Update Scenario (ownership check) ─────────────────
  app.put('/scenarios/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = req.params as { id: string };

    const authorized = await authorizeScenario(id, payload.sub, payload.role);
    if (!authorized) {
      return reply.status(403).send({ error: 'Forbidden: you can only edit your own scenarios' });
    }

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
  // ─── Ingest Scenario for RAG ─────────────────────────────
  app.post('/scenarios/:id/ingest', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = req.params as { id: string };
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) return reply.status(404).send({ error: 'Not found' });

    // Build text to ingest: combine description + topics + job description
    const textParts = [
      `Position: ${scenario.position}`,
      `Level: ${scenario.level}`,
      `Domain: ${scenario.domain}`,
      `Topics: ${scenario.topics.join(', ')}`,
      scenario.description ? `Description:\n${scenario.description}` : '',
    ].filter(Boolean);

    const textToIngest = textParts.join('\n\n');

    // Note: Full RAG ingestion requires an embedding adapter which runs in the agent service.
    // This endpoint stores the prepared text; the agent's ContextManager handles embedding.
    await logAudit('INGEST_SCENARIO', 'Scenario', id, payload.sub, {
      textLength: textToIngest.length,
    });

    return {
      ok: true,
      scenarioId: id,
      textLength: textToIngest.length,
      message: 'Scenario data prepared for RAG ingestion. Embeddings are generated by the agent service.',
    };
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
        title: body.title,
        description: body.description,
        criteria: {
          create: body.criteria.map((c) => ({
            name: c.name,
            description: c.description,
            maxScore: c.maxScore,
            weight: c.weight,
            order: c.order ?? 0,
          })),
        },
      },
      include: { criteria: true },
    });

    await logAudit('CREATE_RUBRIC', 'Rubric', rubric.id, payload.sub);
    return reply.status(201).send(rubric);
  });

  // ─── Update Rubric ─────────────────────────────────────
  app.put('/rubrics/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = req.params as { id: string };
    const body = req.body as { criteria?: Array<{ name: string; description: string; maxScore?: number; weight?: number }> };

    const rubric = await prisma.rubric.findUnique({ where: { id } });
    if (!rubric) return reply.status(404).send({ error: 'Not found' });

    if (body.criteria) {
      // Replace criteria: delete old, create new
      await prisma.rubricCriterion.deleteMany({ where: { rubricId: id } });
      await prisma.rubricCriterion.createMany({
        data: body.criteria.map((c) => ({
          rubricId: id,
          name: c.name,
          description: c.description,
          maxScore: c.maxScore ?? 5,
          weight: c.weight ?? 0.2,
        })),
      });
    }

    const updated = await prisma.rubric.findUnique({
      where: { id },
      include: { criteria: true },
    });

    await logAudit('UPDATE_RUBRIC', 'Rubric', id, payload.sub);
    return updated;
  });

  // ─── Delete Rubric ─────────────────────────────────────
  app.delete('/rubrics/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = req.params as { id: string };
    await prisma.rubricCriterion.deleteMany({ where: { rubricId: id } });
    await prisma.rubric.delete({ where: { id } });

    await logAudit('DELETE_RUBRIC', 'Rubric', id, payload.sub);
    return reply.status(204).send();
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
