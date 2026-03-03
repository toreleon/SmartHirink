import prisma from '../lib/prisma.js';

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string,
  userId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      userId,
      metadata: metadata as any,
    },
  });
}
