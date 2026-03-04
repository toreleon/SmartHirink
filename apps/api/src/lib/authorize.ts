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
    where: { id: sessionId, deletedAt: null },
    include: { 
      candidate: { 
        include: { user: true } 
      },
      recruiter: true,
    },
  });

  if (!session) {
    return { allowed: false, session: null };
  }

  // ADMIN has full access
  if (role === 'ADMIN') {
    return { allowed: true, session };
  }

  // RECRUITER can only access sessions they created
  if (role === 'RECRUITER') {
    return { allowed: session.recruiterId === userId, session };
  }

  // CANDIDATE can only access their own sessions
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
    where: { id: scenarioId, deletedAt: null },
    select: { createdById: true },
  });

  if (!scenario) return false;
  return scenario.createdById === userId;
}

/**
 * Check if a user can modify a candidate profile.
 * CANDIDATE can only modify their own profile.
 * RECRUITER and ADMIN can modify any profile.
 */
export async function authorizeCandidateProfile(
  profileId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === 'ADMIN' || role === 'RECRUITER') return true;

  if (role === 'CANDIDATE') {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: profileId, deletedAt: null },
      select: { userId: true },
    });

    if (!profile) return false;
    return profile.userId === userId;
  }

  return false;
}

/**
 * Check if a user can modify a rubric.
 * Only the creator or ADMIN can modify.
 */
export async function authorizeRubric(
  rubricId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const rubric = await prisma.rubric.findUnique({
    where: { id: rubricId, deletedAt: null },
    include: { scenario: true },
  });

  if (!rubric) return false;
  
  // Only scenario creator can modify rubric
  return rubric.scenario.createdById === userId;
}
