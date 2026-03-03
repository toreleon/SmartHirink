import type { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

export async function auditRoutes(app: FastifyInstance) {
  // ─── List Audit Logs (Admin only, paginated) ───────────
  app.get('/audit-logs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin only' });
    }

    const { page = '1', limit = '50', action, entity } = req.query as {
      page?: string;
      limit?: string;
      action?: string;
      entity?: string;
    };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page: pageNum, limit: limitNum, items };
  });
}
