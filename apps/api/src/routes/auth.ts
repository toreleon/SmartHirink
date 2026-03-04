import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  ProfileUpdateSchema,
} from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';

export async function authRoutes(app: FastifyInstance) {
  // Helper to get user with fullName from profile
  async function getUserWithProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidateProfile: true,
        recruiterProfile: true,
      },
    });
    if (!user) return null;
    
    const fullName = user.candidateProfile?.fullName ?? user.recruiterProfile?.fullName ?? user.email;
    
    return {
      ...user,
      fullName,
    };
  }

  // ─── Register (disabled) ────────────────────────────────
  // Self-registration is disabled. Accounts are created by ADMINs only.
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (_req, reply) => {
      return reply.status(403).send({ error: 'Self-registration is disabled. Please contact your administrator.' });
    },
  );

  // ─── Login (rate limited: 5/min) ──────────────────────
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = LoginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ 
        where: { email: body.email },
        include: {
          candidateProfile: true,
          recruiterProfile: true,
        },
      });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // Candidates access interviews via invite links, not via login
      if (user.role === 'CANDIDATE') {
        return reply.status(403).send({ error: 'Candidate login is disabled. Please use your interview invite link.' });
      }

      await logAudit('LOGIN', 'User', user.id, user.id);

      const token = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '7d' },
      );

      // Set refresh token cookie
      const refreshToken = app.jwt.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '30d' },
      );
      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth/refresh',
        maxAge: 30 * 24 * 60 * 60,
      });

      const fullName = user.candidateProfile?.fullName ?? user.recruiterProfile?.fullName ?? user.email;

      return {
        token,
        user: { id: user.id, email: user.email, fullName, role: user.role },
      };
    },
  );

  // ─── Refresh Token ────────────────────────────────────
  app.post('/auth/refresh', async (req, reply) => {
    const refreshToken = (req.cookies as Record<string, string>)?.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    try {
      const payload = app.jwt.verify<{ sub: string; type: string }>(refreshToken);
      if (payload.type !== 'refresh') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }

      const user = await getUserWithProfile(payload.sub);
      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const token = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '7d' },
      );

      return { 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName, 
          role: user.role 
        },
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // ─── Logout ───────────────────────────────────────────
  app.post('/auth/logout', { onRequest: [app.authenticate] }, async (_req, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return { ok: true };
  });

  // ─── Me ─────────────────────────────────────────────────
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await getUserWithProfile(payload.sub);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  });

  // ─── Change Password ──────────────────────────────────
  app.post('/auth/change-password', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const body = ChangePasswordSchema.parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    await logAudit('CHANGE_PASSWORD', 'User', payload.sub, payload.sub);
    return { ok: true };
  });

  // ─── Update Profile ───────────────────────────────────
  app.put('/auth/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const body = ProfileUpdateSchema.parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ 
      where: { id: payload.sub },
      include: {
        candidateProfile: true,
        recruiterProfile: true,
      },
    });

    // Update user fields
    const updateData: Record<string, unknown> = {};
    if (body.email) updateData.email = body.email;

    // Update profile fullName if provided
    if (body.fullName) {
      if (user.candidateProfile) {
        await prisma.candidateProfile.update({
          where: { userId: payload.sub },
          data: { fullName: body.fullName },
        });
      } else if (user.recruiterProfile) {
        await prisma.recruiterProfile.update({
          where: { userId: payload.sub },
          data: { fullName: body.fullName },
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: payload.sub },
        data: updateData,
      });
    }

    const updatedUser = await getUserWithProfile(payload.sub);

    await logAudit('UPDATE_PROFILE', 'User', payload.sub, payload.sub);
    return updatedUser;
  });
}
