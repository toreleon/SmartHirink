/**
 * Interview Session Repository
 */

import { PrismaClient, InterviewPhase as PrismaInterviewPhase } from '@prisma/client';
import { BaseRepository, logAudit } from './base-repository.js';
import { InterviewPhase } from '@smarthirink/core';

// Map Prisma enum to Core enum
function toCorePhase(phase: PrismaInterviewPhase): InterviewPhase {
  return InterviewPhase[phase as keyof typeof InterviewPhase];
}

function toPrismaPhase(phase: InterviewPhase): PrismaInterviewPhase {
  return PrismaInterviewPhase[phase as keyof typeof PrismaInterviewPhase];
}

export interface InterviewSessionCreateInput {
  scenarioId: string;
  rubricId: string;
  candidateId: string;
  recruiterId: string;
  scheduledAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface InterviewSessionUpdateInput {
  phase?: InterviewPhase;
  scheduledAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  completedAt?: Date | null;
}

interface PhaseTransitionEntry {
  phase: InterviewPhase;
  timestamp: Date;
}

export class InterviewSessionRepository extends BaseRepository<
  any,
  InterviewSessionCreateInput,
  InterviewSessionUpdateInput
> {
  constructor(prisma: PrismaClient) {
    super(prisma, prisma.interviewSession);
  }

  /**
   * Find session with related entities
   */
  async findWithRelations(id: string, options?: { includeDeleted?: boolean }) {
    return this.prisma.interviewSession.findUnique({
      where: { id, deletedAt: options?.includeDeleted ? undefined : null },
      include: {
        scenario: true,
        rubric: { include: { criteria: true } },
        candidate: { include: { user: true } },
        recruiter: true,
        turns: { orderBy: { index: 'asc' } },
        scoreCard: { include: { criteria: true } },
        report: true,
      },
    });
  }

  /**
   * Find sessions by candidate
   */
  async findByCandidate(candidateId: string, options?: { includeDeleted?: boolean }) {
    return this.prisma.interviewSession.findMany({
      where: {
        candidateId,
        deletedAt: options?.includeDeleted ? undefined : null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: true,
        rubric: true,
        recruiter: true,
      },
    });
  }

  /**
   * Find sessions by recruiter
   */
  async findByRecruiter(recruiterId: string, options?: {
    includeDeleted?: boolean;
    phase?: InterviewPhase;
  }) {
    return this.prisma.interviewSession.findMany({
      where: {
        recruiterId,
        phase: options?.phase ? toPrismaPhase(options.phase) : undefined,
        deletedAt: options?.includeDeleted ? undefined : null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        scenario: true,
        candidate: true,
      },
    });
  }

  /**
   * Find sessions by phase
   */
  async findByPhase(phase: InterviewPhase, options?: {
    limit?: number;
    includeDeleted?: boolean;
  }) {
    return this.prisma.interviewSession.findMany({
      where: {
        phase: toPrismaPhase(phase),
        deletedAt: options?.includeDeleted ? undefined : null,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
    });
  }

  /**
   * Create a new interview session
   */
  async create(data: InterviewSessionCreateInput): Promise<any> {
    const session = await this.prisma.interviewSession.create({
      data: {
        ...data,
        phaseHistory: [{ phase: 'CREATED' as any, timestamp: new Date() }],
        metadata: data.metadata ? (JSON.parse(JSON.stringify(data.metadata)) as any) : null,
      },
    });

    await logAudit(this.prisma, {
      action: 'CREATE',
      entity: 'InterviewSession',
      entityId: session.id,
      newData: { phase: session.phase },
    });

    return session;
  }

  /**
   * Update session phase with state machine validation
   */
  async updatePhase(
    id: string,
    newPhase: InterviewPhase,
    userId?: string,
  ): Promise<any> {
    const session = await this.findUniqueOrThrow({ id });

    // Validate phase transition using core state machine
    const { canTransition } = await import('@smarthirink/core');
    const currentPhase = toCorePhase(session.phase as PrismaInterviewPhase);
    
    if (!canTransition(currentPhase, newPhase)) {
      throw new Error(
        `Invalid phase transition: ${currentPhase} → ${newPhase}`,
      );
    }

    // Build update data based on phase
    const updateData: InterviewSessionUpdateInput = {
      phase: newPhase,
    };

    const now = new Date();

    switch (newPhase) {
      case InterviewPhase.IN_PROGRESS:
        updateData.startedAt = now;
        break;
      case InterviewPhase.COMPLETED:
        updateData.completedAt = now;
        break;
      case InterviewPhase.CANCELLED:
      case InterviewPhase.NO_SHOW:
        updateData.endedAt = now;
        break;
    }

    // Update phase history
    const phaseHistory = session.phaseHistory as PhaseTransitionEntry[] || [];
    phaseHistory.push({ phase: newPhase, timestamp: new Date() });

    // Use direct Prisma call — InterviewSession has no `version` field,
    // so we cannot use BaseRepository.update() which adds version increment.
    await this.prisma.interviewSession.update({
      where: { id },
      data: {
        phase: toPrismaPhase(updateData.phase!),
        ...(updateData.startedAt && { startedAt: updateData.startedAt }),
        ...(updateData.completedAt && { completedAt: updateData.completedAt }),
        ...(updateData.endedAt && { endedAt: updateData.endedAt }),
        phaseHistory: JSON.parse(JSON.stringify(phaseHistory)) as any,
      },
    });

    await logAudit(this.prisma, {
      action: 'PHASE_CHANGE',
      entity: 'InterviewSession',
      entityId: id,
      oldData: { phase: session.phase },
      newData: { phase: newPhase },
      userId,
    });

    return this.findUniqueOrThrow({ id });
  }

  /**
   * Start an interview (transition to IN_PROGRESS)
   */
  async start(id: string, userId?: string): Promise<any> {
    const session = await this.findUniqueOrThrow({ id });
    const currentPhase = toCorePhase(session.phase as PrismaInterviewPhase);

    if (currentPhase === InterviewPhase.WAITING) {
      return this.updatePhase(id, InterviewPhase.IN_PROGRESS, userId);
    }

    throw new Error(`Cannot start interview in ${currentPhase} phase`);
  }

  /**
   * Complete an interview
   */
  async complete(id: string, userId?: string): Promise<any> {
    const session = await this.findUniqueOrThrow({ id });
    const currentPhase = toCorePhase(session.phase as PrismaInterviewPhase);

    if (currentPhase === InterviewPhase.IN_PROGRESS) {
      return this.updatePhase(id, InterviewPhase.COMPLETED, userId);
    }

    throw new Error(`Cannot complete interview in ${currentPhase} phase`);
  }

  /**
   * Cancel an interview
   */
  async cancel(id: string, userId?: string): Promise<any> {
    const session = await this.findUniqueOrThrow({ id });
    const currentPhase = toCorePhase(session.phase as PrismaInterviewPhase);

    if (
      currentPhase === InterviewPhase.CREATED ||
      currentPhase === InterviewPhase.SCHEDULED ||
      currentPhase === InterviewPhase.WAITING ||
      currentPhase === InterviewPhase.IN_PROGRESS
    ) {
      return this.updatePhase(id, InterviewPhase.CANCELLED, userId);
    }

    throw new Error(`Cannot cancel interview in ${currentPhase} phase`);
  }

  /**
   * Mark as no-show
   */
  async markNoShow(id: string, userId?: string): Promise<any> {
    const session = await this.findUniqueOrThrow({ id });
    const currentPhase = toCorePhase(session.phase as PrismaInterviewPhase);

    if (currentPhase === InterviewPhase.WAITING) {
      return this.updatePhase(id, InterviewPhase.NO_SHOW, userId);
    }

    throw new Error(`Cannot mark no-show for interview in ${currentPhase} phase`);
  }
}
