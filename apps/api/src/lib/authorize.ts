import prisma from './prisma.js';

/**
 * Authorization helper — checks session access based on user role.
 *
 * - ADMIN: full access
 * - RECRUITER: only sessions they created (recruiterId === userId)
 * - CANDIDATE: only own sessions (candidateProfile.userId === userId)
 */
export async function authorizeSession(
  sessionId: string,
  userId: string,
  role: string,
): Promise<{ allowed: boolean; session: any }> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { candidate: true },
  });

  if (!session) {
    return { allowed: false, session: null };
  }

  if (role === 'ADMIN') {
    return { allowed: true, session };
  }

  if (role === 'RECRUITER') {
    return { allowed: session.recruiterId === userId, session };
  }

  if (role === 'CANDIDATE') {
    return { allowed: session.candidate?.userId === userId, session };
  }

  return { allowed: false, session };
}

/**
 * Check if a user owns a scenario (is the creator or is ADMIN).
 */
export async function authorizeScenario(
  scenarioId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { createdById: true },
  });

  if (!scenario) return false;
  return scenario.createdById === userId;
}
