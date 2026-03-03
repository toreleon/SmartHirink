import type { FastifyInstance } from 'fastify';
import { CandidateProfileCreateSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';

export async function candidateRoutes(app: FastifyInstance) {
  // ─── Create / Update Profile ────────────────────────────
  app.post('/candidates/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const body = CandidateProfileCreateSchema.parse(req.body);

    const profile = await prisma.candidateProfile.upsert({
      where: { userId: payload.sub },
      create: { userId: payload.sub, ...body },
      update: body,
    });

    await logAudit('UPSERT_PROFILE', 'CandidateProfile', profile.id, payload.sub);
    return reply.status(201).send(profile);
  });

  // ─── Get My Profile ─────────────────────────────────────
  app.get('/candidates/profile', { onRequest: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string };
    return prisma.candidateProfile.findUniqueOrThrow({ where: { userId: payload.sub } });
  });

  // ─── Get Candidate by ID (Recruiter/Admin) ─────────────
  app.get('/candidates/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const profile = await prisma.candidateProfile.findUnique({ where: { id } });
    if (!profile) return reply.status(404).send({ error: 'Not found' });
    return profile;
  });

  // ─── List Candidates (Recruiter/Admin) ──────────────────
  app.get('/candidates', { onRequest: [app.authenticate] }, async (req) => {
    const { page = '1', limit = '20' } = req.query as { page?: string; limit?: string };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, items] = await Promise.all([
      prisma.candidateProfile.count(),
      prisma.candidateProfile.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page: parseInt(page), limit: parseInt(limit), items };
  });
}
