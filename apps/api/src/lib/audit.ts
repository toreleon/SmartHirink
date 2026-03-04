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
      action: action as any,
      entity,
      entityId,
      userId,
      metadata: metadata ? (JSON.parse(JSON.stringify(metadata)) as any) : null,
    },
  });
}
