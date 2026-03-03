import type { FastifyInstance } from 'fastify';
import { InterviewSessionCreateSchema, LiveKitTokenRequestSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { ensureRoom, mintLiveKitToken } from '../lib/livekit.js';
import { evaluationQueue, reportQueue } from '../lib/queue.js';
import { logAudit } from '../lib/audit.js';
import { authorizeSession } from '../lib/authorize.js';

export async function interviewRoutes(app: FastifyInstance) {
  // ─── Create Interview Session ──────────────────────────
  app.post('/interviews', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = InterviewSessionCreateSchema.parse(req.body);

    // Validate that the recruiter, scenario, rubric, and candidate all exist
    const [recruiter, scenario, rubric, candidate] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } }),
      prisma.scenario.findUnique({ where: { id: body.scenarioId }, select: { id: true } }),
      prisma.rubric.findUnique({ where: { id: body.rubricId }, select: { id: true } }),
      prisma.candidateProfile.findUnique({ where: { id: body.candidateId }, select: { id: true } }),
    ]);

    if (!recruiter) return reply.status(401).send({ error: 'Your session is invalid. Please log in again.' });
    if (!scenario) return reply.status(404).send({ error: 'Scenario not found' });
    if (!rubric) return reply.status(404).send({ error: 'Rubric not found' });
    if (!candidate) return reply.status(404).send({ error: 'Candidate not found' });

    const session = await prisma.interviewSession.create({
      data: {
        scenarioId: body.scenarioId,
        rubricId: body.rubricId,
        candidateId: body.candidateId,
        recruiterId: payload.sub,
        livekitRoom: `interview_${crypto.randomUUID().slice(0, 8)}`,
        phase: 'CREATED',
      },
    });

    await logAudit('CREATE_SESSION', 'InterviewSession', session.id, payload.sub);
    return reply.status(201).send(session);
  });

  // ─── List Sessions ─────────────────────────────────────
  app.get('/interviews', { onRequest: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string; role: string };
    const { page = '1', limit = '20', phase, candidateId } = req.query as {
      page?: string;
      limit?: string;
      phase?: string;
      candidateId?: string;
    };

    // Clamp pagination bounds
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (payload.role === 'CANDIDATE') {
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId: payload.sub },
        select: { id: true },
      });
      if (profile) where.candidateId = profile.id;
    } else if (payload.role === 'RECRUITER') {
      where.recruiterId = payload.sub;
    }
    if (phase) where.phase = phase;
    if (candidateId && payload.role !== 'CANDIDATE') where.candidateId = candidateId;

    const [total, items] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: { select: { title: true, position: true, level: true } },
          candidate: { select: { fullName: true, email: true } },
        },
      }),
    ]);

    return { total, page: pageNum, limit: limitNum, items };
  });

  // ─── Get Session Detail ────────────────────────────────
  app.get('/interviews/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    // Return full session with includes
    const full = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        scenario: { include: { rubrics: { include: { criteria: true } } } },
        candidate: true,
        turns: { orderBy: { index: 'asc' } },
        scoreCard: true,
        report: true,
      },
    });
    return full;
  });

  // ─── Start Session (set WAITING, create room) ──────────
  app.post('/interviews/:id/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    if (session.phase !== 'CREATED') {
      return reply.status(400).send({ error: 'Session cannot be started from current phase' });
    }

    await ensureRoom(session.livekitRoom);

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { phase: 'WAITING', startedAt: new Date() },
    });

    await logAudit('START_SESSION', 'InterviewSession', id, payload.sub);
    return updated;
  });

  // ─── Finish / Complete Session ─────────────────────────
  app.post('/interviews/:id/finish', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    if (session.phase === 'COMPLETED' || session.phase === 'CANCELLED') {
      return reply.status(400).send({ error: 'Session already ended' });
    }

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { phase: 'COMPLETED', endedAt: new Date() },
    });

    await evaluationQueue.add('evaluate', { sessionId: id }, { jobId: `eval_${id}` });

    await logAudit('FINISH_SESSION', 'InterviewSession', id, payload.sub);
    return updated;
  });

  // ─── Get Transcript ────────────────────────────────────
  app.get('/interviews/:id/transcript', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const turns = await prisma.turn.findMany({
      where: { sessionId: id },
      orderBy: { index: 'asc' },
    });
    if (turns.length === 0) return reply.status(404).send({ error: 'No transcript' });
    return turns;
  });

  // ─── Get ScoreCard ─────────────────────────────────────
  app.get('/interviews/:id/scorecard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const scoreCard = await prisma.scoreCard.findUnique({ where: { sessionId: id } });
    if (!scoreCard) return reply.status(404).send({ error: 'Not yet evaluated' });
    return scoreCard;
  });

  // ─── Get Report ────────────────────────────────────────
  app.get('/interviews/:id/report', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const report = await prisma.report.findUnique({
      where: { sessionId: id },
      include: { scoreCard: true },
    });
    if (!report) return reply.status(404).send({ error: 'Report not ready' });
    return report;
  });

  // ─── LiveKit Token ─────────────────────────────────────
  app.post('/interviews/token', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const body = LiveKitTokenRequestSchema.parse(req.body);

    // Validate that body.role matches user's actual role
    const roleMap: Record<string, string> = {
      candidate: 'CANDIDATE',
      recruiter: 'RECRUITER',
    };
    if (roleMap[body.role] && roleMap[body.role] !== payload.role) {
      return reply.status(403).send({ error: 'Role mismatch: requested role does not match your account' });
    }

    // Verify session access
    const { allowed, session } = await authorizeSession(body.sessionId, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    let identity: string;
    let canPublish = true;
    let canSubscribe = true;

    switch (body.role) {
      case 'candidate':
        identity = `candidate_${session.candidateId}`;
        break;
      case 'recruiter':
        identity = `recruiter_${payload.sub}`;
        canPublish = false;
        break;
      case 'agent':
        identity = `agent_${session.id}`;
        break;
      default:
        return reply.status(400).send({ error: 'Invalid role' });
    }

    const token = await mintLiveKitToken({
      roomName: session.livekitRoom,
      identity,
      canPublish,
      canSubscribe,
      canPublishData: true,
    });

    await logAudit('MINT_TOKEN', 'LiveKit', session.id, payload.sub, {
      role: body.role,
      room: session.livekitRoom,
    });

    return { token, room: session.livekitRoom, identity };
  });

  // ─── LiveKit Webhook (rate limited: 30/min) ─────────────
  app.post(
    '/webhooks/livekit',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      // Verify webhook signature if LIVEKIT_API_KEY and LIVEKIT_API_SECRET are available
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return reply.status(401).send({ error: 'Missing authorization header' });
      }

      // In production, verify with livekit-server-sdk WebhookReceiver
      // For now, check that the auth header exists (basic check)
      const event = req.body as Record<string, unknown>;
      await logAudit('LIVEKIT_EVENT', 'LiveKit', undefined, undefined, event);
      return reply.status(200).send({ ok: true });
    },
  );
}
