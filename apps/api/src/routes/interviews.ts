import type { FastifyInstance } from 'fastify';
import { InterviewSessionCreateSchema, LiveKitTokenRequestSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { ensureRoom, mintLiveKitToken } from '../lib/livekit.js';
import { evaluationQueue, reportQueue } from '../lib/queue.js';
import { logAudit } from '../lib/audit.js';

export async function interviewRoutes(app: FastifyInstance) {
  // ─── Create Interview Session ──────────────────────────
  app.post('/interviews', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = InterviewSessionCreateSchema.parse(req.body);
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
    const { page = '1', limit = '20', phase } = req.query as {
      page?: string;
      limit?: string;
      phase?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (payload.role === 'CANDIDATE') {
      // Candidates see only their own sessions
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId: payload.sub },
        select: { id: true },
      });
      if (profile) where.candidateId = profile.id;
    } else if (payload.role === 'RECRUITER') {
      where.recruiterId = payload.sub;
    }
    if (phase) where.phase = phase;

    const [total, items] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: { select: { title: true, position: true, level: true } },
          candidate: { select: { fullName: true, email: true } },
        },
      }),
    ]);

    return { total, page: parseInt(page), limit: parseInt(limit), items };
  });

  // ─── Get Session Detail ────────────────────────────────
  app.get('/interviews/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        scenario: { include: { rubrics: { include: { criteria: true } } } },
        candidate: true,
        turns: { orderBy: { index: 'asc' } },
        scoreCard: true,
        report: true,
      },
    });
    if (!session) return reply.status(404).send({ error: 'Not found' });
    return session;
  });

  // ─── Start Session (set WAITING, create room) ──────────
  app.post('/interviews/:id/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const session = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });

    if (session.phase !== 'CREATED') {
      return reply.status(400).send({ error: 'Session cannot be started from current phase' });
    }

    // Ensure LiveKit room exists
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
    const payload = req.user as { sub: string };
    const { id } = req.params as { id: string };

    const session = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    if (session.phase === 'COMPLETED' || session.phase === 'CANCELLED') {
      return reply.status(400).send({ error: 'Session already ended' });
    }

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { phase: 'COMPLETED', endedAt: new Date() },
    });

    // Enqueue evaluation job
    await evaluationQueue.add('evaluate', { sessionId: id }, { jobId: `eval_${id}` });

    await logAudit('FINISH_SESSION', 'InterviewSession', id, payload.sub);
    return updated;
  });

  // ─── Get Transcript ────────────────────────────────────
  app.get('/interviews/:id/transcript', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const turns = await prisma.turn.findMany({
      where: { sessionId: id },
      orderBy: { index: 'asc' },
    });
    if (turns.length === 0) return reply.status(404).send({ error: 'No transcript' });
    return turns;
  });

  // ─── Get ScoreCard ─────────────────────────────────────
  app.get('/interviews/:id/scorecard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const scoreCard = await prisma.scoreCard.findUnique({ where: { sessionId: id } });
    if (!scoreCard) return reply.status(404).send({ error: 'Not yet evaluated' });
    return scoreCard;
  });

  // ─── Get Report ────────────────────────────────────────
  app.get('/interviews/:id/report', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
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

    // Verify session exists and user has access
    const session = await prisma.interviewSession.findUniqueOrThrow({
      where: { id: body.sessionId },
      include: { candidate: true },
    });

    // Build identity based on role
    let identity: string;
    let canPublish = true;
    let canSubscribe = true;

    switch (body.role) {
      case 'candidate':
        identity = `candidate_${session.candidateId}`;
        break;
      case 'recruiter':
        identity = `recruiter_${payload.sub}`;
        canPublish = false; // Recruiter only listens
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

  // ─── LiveKit Webhook (optional) ─────────────────────────
  app.post('/webhooks/livekit', async (req, reply) => {
    // LiveKit sends room events here for auditing
    const event = req.body as Record<string, unknown>;
    await logAudit('LIVEKIT_EVENT', 'LiveKit', undefined, undefined, event);
    return reply.status(200).send({ ok: true });
  });
}
