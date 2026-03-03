import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { LoginSchema, RegisterSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';

export async function authRoutes(app: FastifyInstance) {
  // ─── Register ───────────────────────────────────────────
  app.post('/auth/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        fullName: body.fullName,
        role: body.role,
      },
    });

    await logAudit('REGISTER', 'User', user.id, user.id);

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  });

  // ─── Login ──────────────────────────────────────────────
  app.post('/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await logAudit('LOGIN', 'User', user.id, user.id);

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
  });

  // ─── Me ─────────────────────────────────────────────────
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });
    return user;
  });
}
