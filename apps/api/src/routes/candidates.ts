import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { CandidateProfileCreateSchema } from '@smarthirink/core';
import prisma from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';
import { parseCvToCandidate } from '../lib/llm-parser.js';
import { extractTextFromFile } from '../lib/pdf-extract.js';

export async function candidateRoutes(app: FastifyInstance) {
  // ─── Parse CV → Create Candidate (Recruiter/Admin only) ─
  app.post('/candidates/parse-cv', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Accept multipart file (PDF or text) or JSON body with cvText
    let cvText: string;

    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      const file = await req.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }
      const buffer = await file.toBuffer();
      cvText = await extractTextFromFile(buffer, file.mimetype, file.filename);
    } else {
      const body = req.body as { cvText?: string };
      if (!body?.cvText) {
        return reply.status(400).send({ error: 'cvText is required' });
      }
      cvText = body.cvText;
    }

    if (!cvText.trim()) {
      return reply.status(400).send({ error: 'CV text is empty' });
    }

    // Parse CV via LLM
    let parsed;
    try {
      parsed = await parseCvToCandidate(cvText);
    } catch (err: any) {
      req.log.error({ err: err.message, stack: err.stack }, 'CV parse failed');
      return reply.status(500).send({ error: `CV parsing failed: ${err.message}` });
    }

    // Build the structured parsedData JSON
    const parsedData = {
      workExperience: parsed.workExperience,
      education: parsed.education,
      certifications: parsed.certifications,
      projects: parsed.projects,
      languages: parsed.languages,
    };

    const profileData = {
      fullName: parsed.fullName,
      phone: parsed.phone,
      skills: parsed.skills,
      experienceYears: parsed.experienceYears,
      headline: parsed.headline,
      summary: parsed.summary,
      location: parsed.location,
      linkedinUrl: parsed.linkedinUrl,
      githubUrl: parsed.githubUrl,
      portfolioUrl: parsed.portfolioUrl,
      resumeText: parsed.resumeText,
      parsedData: parsedData as any,
    };

    // Check if a candidate with this email already exists
    const existingProfile = await prisma.candidateProfile.findFirst({
      where: { email: parsed.email.toLowerCase() },
    });

    if (existingProfile) {
      const updated = await prisma.candidateProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
      });

      await logAudit('UPDATE', 'CandidateProfile', updated.id, payload.sub);
      return reply.status(200).send({ candidate: updated, parsed, created: false });
    }

    // Create new User + CandidateProfile
    const passwordHash = await bcrypt.hash(`candidate_${Date.now()}`, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.email.toLowerCase(),
        passwordHash,
        fullName: parsed.fullName,
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            email: parsed.email.toLowerCase(),
            ...profileData,
          },
        },
      },
      include: { candidateProfile: true },
    });

    await logAudit('CREATE', 'CandidateProfile', user.candidateProfile!.id, payload.sub);
    return reply.status(201).send({ candidate: user.candidateProfile, parsed, created: true });
  });

  // ─── Create / Update Profile ────────────────────────────
  app.post('/candidates/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const body = CandidateProfileCreateSchema.parse(req.body);

    const profile = await prisma.candidateProfile.upsert({
      where: { userId: payload.sub },
      create: { userId: payload.sub, ...body },
      update: body,
    });

    await logAudit('UPSERT_PROFILE', 'CandidateProfile', profile.id, payload.sub);
    return reply.status(201).send(profile);
  });

  // ─── Get My Profile ─────────────────────────────────────
  app.get('/candidates/profile', { onRequest: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string };
    return prisma.candidateProfile.findUniqueOrThrow({ where: { userId: payload.sub } });
  });

  // ─── Get Candidate by ID (Recruiter/Admin only) ────────
  app.get('/candidates/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = req.params as { id: string };
    const profile = await prisma.candidateProfile.findUnique({ where: { id } });
    if (!profile) return reply.status(404).send({ error: 'Not found' });
    return profile;
  });

  // ─── List Candidates (Recruiter/Admin only) ─────────────
  app.get('/candidates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; role: string };
    if (payload.role === 'CANDIDATE') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { page = '1', limit = '20' } = req.query as { page?: string; limit?: string };

    // Clamp pagination bounds
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      prisma.candidateProfile.count(),
      prisma.candidateProfile.findMany({
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page: pageNum, limit: limitNum, items };
  });
}
