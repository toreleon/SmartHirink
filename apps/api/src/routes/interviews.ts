import type { FastifyInstance } from 'fastify';
import { InterviewPhase as PrismaInterviewPhase } from '@prisma/client';
import { InterviewPhase, InterviewSessionCreateSchema, LiveKitTokenRequestSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { InterviewSessionRepository } from '../lib/interview-repository.js';
import { ensureRoom, mintLiveKitToken } from '../lib/livekit.js';
import { logAudit } from '../lib/audit.js';
import { authorizeSession } from '../lib/authorize.js';
import { evaluationQueue } from '../lib/queue.js';
import { sendInterviewInvite } from '../lib/email.js';
import { loadEnv } from '../config.js';

export async function interviewRoutes(app: FastifyInstance) {
  const repo = new InterviewSessionRepository(prisma);

  // ─── Create Interview Session ──────────────────────────
  app.post('/interviews', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = InterviewSessionCreateSchema.parse(req.body);

    // Validate that the recruiter, scenario, rubric, and candidate all exist
    const [recruiter, scenario, rubric, candidate] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } }),
      prisma.scenario.findUnique({ where: { id: body.scenarioId }, select: { id: true, deletedAt: true } }),
      prisma.rubric.findUnique({ where: { id: body.rubricId }, select: { id: true, deletedAt: true } }),
      prisma.candidateProfile.findUnique({ where: { id: body.candidateId }, select: { id: true, deletedAt: true } }),
    ]);

    if (!recruiter || recruiter.role !== 'RECRUITER' && recruiter.role !== 'ADMIN') {
      return reply.status(401).send({ error: 'Your session is invalid. Please log in again.' });
    }
    if (!scenario) return reply.status(404).send({ error: 'Scenario not found' });
    if (!rubric) return reply.status(404).send({ error: 'Rubric not found' });
    if (!candidate) return reply.status(404).send({ error: 'Candidate not found' });

    const session = await repo.create({
      scenarioId: body.scenarioId,
      rubricId: body.rubricId,
      candidateId: body.candidateId,
      recruiterId: payload.sub,
      livekitRoom: `interview_${crypto.randomUUID().slice(0, 8)}`,
      scheduledAt: body.scheduledAt ?? null,
      metadata: body.metadata ?? {},
    });

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

    const where: Record<string, unknown> = {};
    let profileId: string | undefined;

    if (payload.role === 'CANDIDATE') {
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId: payload.sub },
        select: { id: true },
      });
      if (profile) profileId = profile.id;
      where.candidateId = profileId;
    } else if (payload.role === 'RECRUITER' || payload.role === 'ADMIN') {
      if (payload.role === 'RECRUITER') {
        where.recruiterId = payload.sub;
      }
      if (candidateId) {
        where.candidateId = candidateId;
      }
    }

    if (phase) {
      where.phase = phase;
    }

    const [total, items] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: { select: { title: true, position: true, level: true } },
          candidate: { select: { fullName: true, email: true } },
          recruiter: { 
            include: {
              candidateProfile: true,
              recruiterProfile: true,
            },
          },
        },
      }),
    ]);

    // Map recruiter fullName from profile
    const itemsWithNames = items.map((item: any) => ({
      ...item,
      recruiter: {
        ...item.recruiter,
        fullName: item.recruiter.candidateProfile?.fullName ?? item.recruiter.recruiterProfile?.fullName ?? item.recruiter.email,
      },
    }));

    return { total, page: pageNum, limit: limitNum, items: itemsWithNames };
  });

  // ─── Get Session Detail ────────────────────────────────
  app.get('/interviews/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const full = await repo.findWithRelations(id);
    return full;
  });

  // ─── Start Session (transition WAITING → IN_PROGRESS) ──
  app.post('/interviews/:id/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    // Ensure LiveKit room exists
    await ensureRoom(session.livekitRoom);

    // Transition to WAITING first if CREATED
    let updatedSession = session;
    if (session.phase === PrismaInterviewPhase.CREATED) {
      updatedSession = await repo.updatePhase(id, InterviewPhase.WAITING, payload.sub);
    }

    if (updatedSession.phase !== PrismaInterviewPhase.WAITING) {
      return reply.status(400).send({
        error: `Session cannot be started from ${updatedSession.phase} phase. Must be in WAITING phase.`
      });
    }

    const finalSession = await repo.start(id, payload.sub);
    return finalSession;
  });

  // ─── Finish / Complete Session ─────────────────────────
  app.post('/interviews/:id/finish', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    if (session.phase !== 'IN_PROGRESS') {
      return reply.status(400).send({ 
        error: `Session cannot be finished from ${session.phase} phase. Must be in IN_PROGRESS phase.` 
      });
    }

    const updated = await repo.complete(id, payload.sub);

    // Queue evaluation job
    await evaluationQueue.add('evaluate', { sessionId: id }, { jobId: `eval_${id}` });

    return updated;
  });

  // ─── Cancel Session ────────────────────────────────────
  app.post('/interviews/:id/cancel', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const updated = await repo.cancel(id, payload.sub);
    return updated;
  });

  // ─── Mark No-Show ──────────────────────────────────────
  app.post('/interviews/:id/no-show', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    if (session.phase !== 'WAITING') {
      return reply.status(400).send({ error: 'Can only mark no-show for WAITING sessions' });
    }

    const updated = await repo.markNoShow(id, payload.sub);
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
    return turns;
  });

  // ─── Get ScoreCard ─────────────────────────────────────
  app.get('/interviews/:id/scorecard', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const scoreCard = await prisma.scoreCard.findUnique({ 
      where: { sessionId: id },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });
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
      include: { scoreCard: { include: { criteria: true } } },
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
      return reply.status(403).send({ 
        error: 'Role mismatch: requested role does not match your account' 
      });
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

  // ─── Reschedule Interview ──────────────────────────────
  app.patch('/interviews/:id/reschedule', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };
    const { scheduledAt } = req.body as { scheduledAt: string };

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    if (session.phase !== 'CREATED' && session.phase !== 'SCHEDULED') {
      return reply.status(400).send({ error: 'Can only reschedule CREATED or SCHEDULED sessions' });
    }

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: {
        scheduledAt: new Date(scheduledAt),
        phase: 'SCHEDULED',
      },
    });

    await logAudit('RESCHEDULE', 'InterviewSession', id, payload.sub, {
      scheduledAt,
    });

    return updated;
  });

  // ─── Send Invite Email (RECRUITER/ADMIN) ────────────────
  app.post('/interviews/:id/send-invite', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    const { id } = req.params as { id: string };

    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { allowed, session } = await authorizeSession(id, payload.sub, payload.role);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    if (!allowed) return reply.status(403).send({ error: 'Forbidden' });

    const terminalPhases = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (terminalPhases.includes(session.phase)) {
      return reply.status(400).send({ error: `Cannot send invite for ${session.phase} session` });
    }

    // Load full session with relations
    const fullSession = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        scenario: true,
        candidate: true,
      },
    });
    if (!fullSession || !fullSession.candidate) {
      return reply.status(404).send({ error: 'Session or candidate not found' });
    }

    // Generate invite token (or reuse existing one)
    const inviteToken = fullSession.inviteToken || crypto.randomUUID();
    const env = loadEnv();
    const interviewUrl = `${env.APP_URL}/interview/join/${inviteToken}`;

    // Update session with invite token and sent timestamp
    await prisma.interviewSession.update({
      where: { id },
      data: {
        inviteToken,
        inviteSentAt: new Date(),
      },
    });

    // Send the email
    await sendInterviewInvite({
      candidateEmail: fullSession.candidate.email,
      candidateName: fullSession.candidate.fullName,
      interviewUrl,
      scenarioTitle: fullSession.scenario.title,
      position: fullSession.scenario.position,
      scheduledAt: fullSession.scheduledAt,
    });

    await logAudit('CREATE', 'InviteEmail', id, payload.sub, {
      candidateEmail: fullSession.candidate.email,
      inviteToken,
    });

    return { ok: true, inviteUrl: interviewUrl };
  });

  // ─── Public: Get Interview by Invite Token ──────────────
  app.get('/interviews/invite/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    const session = await prisma.interviewSession.findUnique({
      where: { inviteToken: token },
      include: {
        scenario: { select: { title: true, position: true, level: true, durationMinutes: true, description: true } },
        candidate: { select: { fullName: true, email: true } },
      },
    });

    if (!session || session.deletedAt) {
      return reply.status(404).send({ error: 'Interview not found or link is invalid' });
    }

    return {
      id: session.id,
      phase: session.phase,
      scheduledAt: session.scheduledAt,
      inviteSentAt: session.inviteSentAt,
      scenario: session.scenario,
      candidate: session.candidate,
      livekitRoom: session.livekitRoom,
    };
  });

  // ─── Public: Join Interview via Invite Token ─────────────
  app.post('/interviews/invite/:token/join', async (req, reply) => {
    const { token } = req.params as { token: string };

    const session = await prisma.interviewSession.findUnique({
      where: { inviteToken: token },
      include: {
        candidate: { select: { id: true, fullName: true } },
        scenario: { select: { title: true, position: true } },
      },
    });

    if (!session || session.deletedAt) {
      return reply.status(404).send({ error: 'Interview not found or link is invalid' });
    }

    const terminalPhases = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (terminalPhases.includes(session.phase)) {
      return reply.status(400).send({ error: `This interview is ${session.phase.toLowerCase().replace('_', ' ')}` });
    }

    // Ensure LiveKit room exists
    await ensureRoom(session.livekitRoom);

    // Transition to WAITING if still CREATED or SCHEDULED
    if (session.phase === 'CREATED' || session.phase === 'SCHEDULED') {
      await repo.updatePhase(session.id, InterviewPhase.WAITING, 'invite-link');
    }

    // Mint LiveKit token for the candidate
    const identity = `candidate_${session.candidateId}`;
    const livekitToken = await mintLiveKitToken({
      roomName: session.livekitRoom,
      identity,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    await logAudit('MINT_TOKEN', 'LiveKit', session.id, undefined, {
      role: 'candidate',
      room: session.livekitRoom,
      via: 'invite-link',
    });

    return {
      livekitToken,
      room: session.livekitRoom,
      identity,
      interview: {
        id: session.id,
        phase: 'WAITING',
        scenario: session.scenario,
        candidate: session.candidate,
      },
    };
  });
}
