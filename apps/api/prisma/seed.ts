/**
 * SmartHirink – Database Seed Script (Updated for Entity Redesign)
 *
 * Creates realistic template data for demonstration and development:
 *   - 1 Admin, 2 Recruiters (with profiles), 5 Candidates (with profiles)
 *   - 6 Interview Scenarios across different domains/levels
 *   - Rubrics with detailed evaluation criteria for each scenario
 *   - 8 Interview Sessions in various phases (with sample turns, scorecards, reports)
 *   - 1 Default Model Config
 *
 * Usage:
 *   cd apps/api
 *   npx tsx prisma/seed.ts          # or: npm run db:seed
 *
 * All passwords: "password123"
 */

import { PrismaClient, UserRole, InterviewPhase, InterviewLevel, SpeakerRole, Recommendation } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD_HASH = bcrypt.hashSync('password123', 10);

// ─── Helper ──────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

function ago(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

// ─── IDs (pre-generated so we can cross-reference) ──────
const ids = {
  // Users
  admin: uuid(),
  recruiterAlice: uuid(),
  recruiterBob: uuid(),
  candidateCharlie: uuid(),
  candidateDiana: uuid(),
  candidateEvan: uuid(),
  candidateFiona: uuid(),
  candidateGeorge: uuid(),

  // Recruiter profiles
  recruiterProfileAlice: uuid(),
  recruiterProfileBob: uuid(),

  // Candidate profiles
  profileCharlie: uuid(),
  profileDiana: uuid(),
  profileEvan: uuid(),
  profileFiona: uuid(),
  profileGeorge: uuid(),

  // Scenarios
  scenarioBackend: uuid(),
  scenarioFrontend: uuid(),
  scenarioFullstack: uuid(),
  scenarioDevops: uuid(),
  scenarioDataEng: uuid(),
  scenarioSystemDesign: uuid(),

  // Rubrics
  rubricBackend: uuid(),
  rubricFrontend: uuid(),
  rubricFullstack: uuid(),
  rubricDevops: uuid(),
  rubricDataEng: uuid(),
  rubricSystemDesign: uuid(),

  // Sessions
  session1: uuid(),
  session2: uuid(),
  session3: uuid(),
  session4: uuid(),
  session5: uuid(),
  session6: uuid(),
  session7: uuid(),
  session8: uuid(),

  // Scorecards
  scorecard1: uuid(),
  scorecard2: uuid(),
  scorecard3: uuid(),

  // Reports
  report1: uuid(),

  // Model config
  modelConfig: uuid(),
};

// ═══════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════
const users = [
  {
    id: ids.admin,
    email: 'admin@smarthirink.com',
    fullName: 'Admin',
    passwordHash: PASSWORD_HASH,
    role: UserRole.ADMIN,
    isActive: true,
  },
  {
    id: ids.recruiterAlice,
    email: 'alice.nguyen@smarthirink.com',
    fullName: 'Alice Nguyen',
    passwordHash: PASSWORD_HASH,
    role: UserRole.RECRUITER,
    isActive: true,
    lastLoginAt: ago(0),
  },
  {
    id: ids.recruiterBob,
    email: 'bob.tran@smarthirink.com',
    fullName: 'Bob Tran',
    passwordHash: PASSWORD_HASH,
    role: UserRole.RECRUITER,
    isActive: true,
    lastLoginAt: ago(1),
  },
  {
    id: ids.candidateCharlie,
    email: 'charlie.le@example.com',
    fullName: 'Charlie Le',
    passwordHash: PASSWORD_HASH,
    role: UserRole.CANDIDATE,
    isActive: true,
  },
  {
    id: ids.candidateDiana,
    email: 'diana.pham@example.com',
    fullName: 'Diana Pham',
    passwordHash: PASSWORD_HASH,
    role: UserRole.CANDIDATE,
    isActive: true,
  },
  {
    id: ids.candidateEvan,
    email: 'evan.vo@example.com',
    fullName: 'Evan Vo',
    passwordHash: PASSWORD_HASH,
    role: UserRole.CANDIDATE,
    isActive: true,
  },
  {
    id: ids.candidateFiona,
    email: 'fiona.hoang@example.com',
    fullName: 'Fiona Hoang',
    passwordHash: PASSWORD_HASH,
    role: UserRole.CANDIDATE,
    isActive: true,
  },
  {
    id: ids.candidateGeorge,
    email: 'george.do@example.com',
    fullName: 'George Do',
    passwordHash: PASSWORD_HASH,
    role: UserRole.CANDIDATE,
    isActive: true,
  },
];

// ═══════════════════════════════════════════════════════════
// RECRUITER PROFILES
// ═══════════════════════════════════════════════════════════
const recruiterProfiles = [
  {
    id: ids.recruiterProfileAlice,
    userId: ids.recruiterAlice,
    fullName: 'Alice Nguyen',
    email: 'alice.nguyen@smarthirink.com',
    title: 'Senior Technical Recruiter',
    department: 'Engineering Hiring',
    phone: '+1-555-0101',
    companyInfo: {
      name: 'SmartHirink Inc.',
      logo: '/logo.png',
      website: 'https://smarthirink.com',
    },
    preferences: {
      timezone: 'America/New_York',
      notifications: { email: true, sms: false },
    },
  },
  {
    id: ids.recruiterProfileBob,
    userId: ids.recruiterBob,
    fullName: 'Bob Tran',
    email: 'bob.tran@smarthirink.com',
    title: 'Technical Recruiter',
    department: 'Engineering Hiring',
    phone: '+1-555-0102',
    companyInfo: {
      name: 'SmartHirink Inc.',
      logo: '/logo.png',
      website: 'https://smarthirink.com',
    },
    preferences: {
      timezone: 'America/Los_Angeles',
      notifications: { email: true, sms: true },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// CANDIDATE PROFILES
// ═══════════════════════════════════════════════════════════
const candidateProfiles = [
  {
    id: ids.profileCharlie,
    userId: ids.candidateCharlie,
    fullName: 'Charlie Le',
    email: 'charlie.le@example.com',
    phone: '+1-555-0201',
    resumeUrl: 'https://example.com/resumes/charlie.pdf',
    resumeText: 'Backend engineer with 4 years of experience in Node.js, TypeScript, and PostgreSQL...',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'NestJS', 'Microservices'],
    experienceYears: 4,
    headline: 'Senior Backend Engineer',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/charliele',
    githubUrl: 'https://github.com/charliele',
  },
  {
    id: ids.profileDiana,
    userId: ids.candidateDiana,
    fullName: 'Diana Pham',
    email: 'diana.pham@example.com',
    phone: '+1-555-0202',
    resumeUrl: 'https://example.com/resumes/diana.pdf',
    resumeText: 'Frontend developer with 3 years of experience in React, TypeScript, and design systems...',
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Storybook', 'Accessibility'],
    experienceYears: 3,
    headline: 'Frontend Developer',
    location: 'New York, NY',
    linkedinUrl: 'https://linkedin.com/in/dianapham',
    githubUrl: 'https://github.com/dianapham',
  },
  {
    id: ids.profileEvan,
    userId: ids.candidateEvan,
    fullName: 'Evan Vo',
    email: 'evan.vo@example.com',
    phone: '+1-555-0203',
    resumeUrl: 'https://example.com/resumes/evan.pdf',
    resumeText: 'Full-stack engineer with 6 years of experience building scalable web applications...',
    skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'System Design', 'Leadership'],
    experienceYears: 6,
    headline: 'Senior Full-Stack Engineer',
    location: 'Austin, TX',
    linkedinUrl: 'https://linkedin.com/in/evanvo',
    githubUrl: 'https://github.com/evanvo',
  },
  {
    id: ids.profileFiona,
    userId: ids.candidateFiona,
    fullName: 'Fiona Hoang',
    email: 'fiona.hoang@example.com',
    phone: '+1-555-0204',
    resumeUrl: 'https://example.com/resumes/fiona.pdf',
    resumeText: 'DevOps engineer with 5 years of experience in cloud infrastructure and CI/CD...',
    skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD', 'Monitoring'],
    experienceYears: 5,
    headline: 'DevOps Engineer',
    location: 'Seattle, WA',
    linkedinUrl: 'https://linkedin.com/in/fionahoang',
    githubUrl: 'https://github.com/fionahoang',
  },
  {
    id: ids.profileGeorge,
    userId: ids.candidateGeorge,
    fullName: 'George Do',
    email: 'george.do@example.com',
    phone: '+1-555-0205',
    resumeUrl: 'https://example.com/resumes/george.pdf',
    resumeText: 'Data engineer with 4 years of experience building data pipelines and analytics platforms...',
    skills: ['Python', 'Spark', 'Airflow', 'Snowflake', 'SQL', 'Data Modeling'],
    experienceYears: 4,
    headline: 'Data Engineer',
    location: 'Boston, MA',
    linkedinUrl: 'https://linkedin.com/in/georgedo',
    githubUrl: 'https://github.com/georgedo',
  },
];

// ═══════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════
const scenarios = [
  {
    id: ids.scenarioBackend,
    version: 1,
    title: 'Backend Engineer Interview',
    description: 'Assess the candidate on server-side development skills including API design, database optimization, caching strategies, and microservices architecture.',
    position: 'Backend Engineer',
    level: InterviewLevel.MID,
    domain: 'Software Engineering',
    topics: ['API Design', 'Database Optimization', 'Caching', 'Microservices'],
    questionCount: 10,
    durationMinutes: 30,
    isPublished: true,
    isTemplate: false,
    createdById: ids.recruiterAlice,
  },
  {
    id: ids.scenarioFrontend,
    version: 1,
    title: 'Frontend Developer Interview',
    description: 'Evaluate frontend skills including React/TypeScript proficiency, performance optimization, accessibility, and modern CSS practices.',
    position: 'Frontend Developer',
    level: InterviewLevel.MID,
    domain: 'Software Engineering',
    topics: ['React', 'TypeScript', 'Performance', 'Accessibility', 'CSS'],
    questionCount: 8,
    durationMinutes: 30,
    isPublished: true,
    isTemplate: false,
    createdById: ids.recruiterAlice,
  },
  {
    id: ids.scenarioFullstack,
    version: 1,
    title: 'Senior Full-Stack Engineer Interview',
    description: 'Comprehensive full-stack interview covering system design, database architecture, API design, and frontend-backend integration.',
    position: 'Senior Full-Stack Engineer',
    level: InterviewLevel.SENIOR,
    domain: 'Software Engineering',
    topics: ['System Design', 'API Design', 'Database Architecture', 'React', 'Node.js'],
    questionCount: 12,
    durationMinutes: 45,
    isPublished: true,
    isTemplate: false,
    createdById: ids.recruiterAlice,
  },
  {
    id: ids.scenarioDevops,
    version: 1,
    title: 'DevOps / SRE Engineer Interview',
    description: 'Assess DevOps and SRE skills including cloud infrastructure, containerization, CI/CD pipelines, monitoring, and incident response.',
    position: 'DevOps Engineer',
    level: InterviewLevel.MID,
    domain: 'DevOps',
    topics: ['AWS', 'Kubernetes', 'CI/CD', 'Monitoring', 'Incident Response'],
    questionCount: 10,
    durationMinutes: 35,
    isPublished: true,
    isTemplate: false,
    createdById: ids.recruiterBob,
  },
  {
    id: ids.scenarioDataEng,
    version: 1,
    title: 'Data Engineer Interview',
    description: 'Evaluate data engineering skills including ETL pipelines, data modeling, big data technologies, and SQL optimization.',
    position: 'Data Engineer',
    level: InterviewLevel.MID,
    domain: 'Data Engineering',
    topics: ['ETL', 'Data Modeling', 'Spark', 'SQL', 'Data Warehousing'],
    questionCount: 10,
    durationMinutes: 35,
    isPublished: true,
    isTemplate: false,
    createdById: ids.recruiterBob,
  },
  {
    id: ids.scenarioSystemDesign,
    version: 1,
    title: 'System Design Interview — Staff Level',
    description: 'Deep-dive system design interview for staff-level candidates. Expect questions on designing large-scale distributed systems, handling trade-offs, capacity estimation, and real-world production considerations.',
    position: 'Staff Engineer',
    level: InterviewLevel.STAFF,
    domain: 'Software Engineering',
    topics: ['System Design', 'Distributed Systems', 'Scalability', 'Trade-offs'],
    questionCount: 5,
    durationMinutes: 60,
    isPublished: true,
    isTemplate: true,
    createdById: ids.recruiterAlice,
  },
];

// ═══════════════════════════════════════════════════════════
// RUBRICS
// ═══════════════════════════════════════════════════════════
const rubrics = [
  {
    id: ids.rubricBackend,
    version: 1,
    scenarioId: ids.scenarioBackend,
    title: 'Backend Engineer Evaluation Rubric',
    description: 'Evaluation criteria for backend engineering interviews',
    criteria: [
      { name: 'Technical Depth', description: 'Demonstrates deep understanding of backend concepts', maxScore: 10, weight: 0.3, order: 0 },
      { name: 'Problem Solving', description: 'Approaches problems systematically', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'Communication', description: 'Explains technical concepts clearly', maxScore: 10, weight: 0.25, order: 2 },
      { name: 'Best Practices', description: 'Follows industry best practices', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
  {
    id: ids.rubricFrontend,
    version: 1,
    scenarioId: ids.scenarioFrontend,
    title: 'Frontend Developer Evaluation Rubric',
    description: 'Evaluation criteria for frontend engineering interviews',
    criteria: [
      { name: 'React Proficiency', description: 'Strong understanding of React patterns', maxScore: 10, weight: 0.3, order: 0 },
      { name: 'CSS & Design', description: 'Creates visually appealing and responsive UIs', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'Accessibility', description: 'Implements accessible components', maxScore: 10, weight: 0.25, order: 2 },
      { name: 'Performance', description: 'Optimizes for performance', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
  {
    id: ids.rubricFullstack,
    version: 1,
    scenarioId: ids.scenarioFullstack,
    title: 'Full-Stack Engineer Evaluation Rubric',
    description: 'Evaluation criteria for full-stack engineering interviews',
    criteria: [
      { name: 'System Design', description: 'Designs scalable and maintainable systems', maxScore: 10, weight: 0.3, order: 0 },
      { name: 'Technical Breadth', description: 'Demonstrates knowledge across the stack', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'Problem Solving', description: 'Approaches problems systematically', maxScore: 10, weight: 0.25, order: 2 },
      { name: 'Communication', description: 'Explains technical concepts clearly', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
  {
    id: ids.rubricDevops,
    version: 1,
    scenarioId: ids.scenarioDevops,
    title: 'DevOps Engineer Evaluation Rubric',
    description: 'Evaluation criteria for DevOps engineering interviews',
    criteria: [
      { name: 'Cloud Infrastructure', description: 'Strong AWS/cloud knowledge', maxScore: 10, weight: 0.3, order: 0 },
      { name: 'Automation', description: 'Automates repetitive tasks effectively', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'Troubleshooting', description: 'Diagnoses and resolves issues efficiently', maxScore: 10, weight: 0.25, order: 2 },
      { name: 'Security', description: 'Implements security best practices', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
  {
    id: ids.rubricDataEng,
    version: 1,
    scenarioId: ids.scenarioDataEng,
    title: 'Data Engineer Evaluation Rubric',
    description: 'Evaluation criteria for data engineering interviews',
    criteria: [
      { name: 'Data Modeling', description: 'Designs efficient data models', maxScore: 10, weight: 0.3, order: 0 },
      { name: 'ETL Design', description: 'Builds robust ETL pipelines', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'SQL Proficiency', description: 'Writes optimized SQL queries', maxScore: 10, weight: 0.25, order: 2 },
      { name: 'Big Data Tools', description: 'Experience with Spark, Airflow, etc.', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
  {
    id: ids.rubricSystemDesign,
    version: 1,
    scenarioId: ids.scenarioSystemDesign,
    title: 'System Design Evaluation Rubric',
    description: 'Evaluation criteria for staff-level system design interviews',
    criteria: [
      { name: 'Architecture Design', description: 'Creates scalable and resilient architectures', maxScore: 10, weight: 0.35, order: 0 },
      { name: 'Trade-off Analysis', description: 'Clearly articulates trade-offs', maxScore: 10, weight: 0.25, order: 1 },
      { name: 'Capacity Planning', description: 'Estimates and plans for scale', maxScore: 10, weight: 0.2, order: 2 },
      { name: 'Production Experience', description: 'Applies real-world production knowledge', maxScore: 10, weight: 0.2, order: 3 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// INTERVIEW SESSIONS
// ═══════════════════════════════════════════════════════════
const sessions = [
  {
    id: ids.session1,
    scenarioId: ids.scenarioBackend,
    rubricId: ids.rubricBackend,
    candidateId: ids.profileCharlie,
    recruiterId: ids.recruiterAlice,
    livekitRoom: 'interview_backend_charlie',
    phase: InterviewPhase.COMPLETED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(14) },
      { phase: InterviewPhase.WAITING, timestamp: ago(14) },
      { phase: InterviewPhase.IN_PROGRESS, timestamp: new Date(ago(14).getTime() + 60000) },
      { phase: InterviewPhase.COMPLETED, timestamp: new Date(ago(14).getTime() + 3600000) },
    ],
    scheduledAt: null,
    startedAt: ago(14),
    completedAt: new Date(ago(14).getTime() + 3600000),
    metadata: { language: 'en', timezone: 'America/New_York' },
  },
  {
    id: ids.session2,
    scenarioId: ids.scenarioFrontend,
    rubricId: ids.rubricFrontend,
    candidateId: ids.profileDiana,
    recruiterId: ids.recruiterAlice,
    livekitRoom: 'interview_frontend_diana',
    phase: InterviewPhase.COMPLETED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(12) },
      { phase: InterviewPhase.WAITING, timestamp: ago(12) },
      { phase: InterviewPhase.IN_PROGRESS, timestamp: new Date(ago(12).getTime() + 60000) },
      { phase: InterviewPhase.COMPLETED, timestamp: new Date(ago(12).getTime() + 3000000) },
    ],
    scheduledAt: null,
    startedAt: ago(12),
    completedAt: new Date(ago(12).getTime() + 3000000),
    metadata: { language: 'en', timezone: 'America/New_York' },
  },
  {
    id: ids.session3,
    scenarioId: ids.scenarioFullstack,
    rubricId: ids.rubricFullstack,
    candidateId: ids.profileEvan,
    recruiterId: ids.recruiterAlice,
    livekitRoom: 'interview_fullstack_evan',
    phase: InterviewPhase.COMPLETED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(10) },
      { phase: InterviewPhase.WAITING, timestamp: ago(10) },
      { phase: InterviewPhase.IN_PROGRESS, timestamp: new Date(ago(10).getTime() + 60000) },
      { phase: InterviewPhase.COMPLETED, timestamp: new Date(ago(10).getTime() + 4500000) },
    ],
    scheduledAt: null,
    startedAt: ago(10),
    completedAt: new Date(ago(10).getTime() + 4500000),
    metadata: { language: 'en', timezone: 'America/Chicago' },
  },
  {
    id: ids.session4,
    scenarioId: ids.scenarioDevops,
    rubricId: ids.rubricDevops,
    candidateId: ids.profileFiona,
    recruiterId: ids.recruiterBob,
    livekitRoom: 'interview_devops_fiona',
    phase: InterviewPhase.WAITING,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(2) },
      { phase: InterviewPhase.WAITING, timestamp: ago(2) },
    ],
    scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
    metadata: { language: 'en', timezone: 'America/Los_Angeles' },
  },
  {
    id: ids.session5,
    scenarioId: ids.scenarioDataEng,
    rubricId: ids.rubricDataEng,
    candidateId: ids.profileGeorge,
    recruiterId: ids.recruiterBob,
    livekitRoom: 'interview_dataeng_george',
    phase: InterviewPhase.SCHEDULED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(1) },
      { phase: InterviewPhase.SCHEDULED, timestamp: ago(1) },
    ],
    scheduledAt: new Date(Date.now() + 172800000), // 2 days from now
    metadata: { language: 'en', timezone: 'America/New_York' },
  },
  {
    id: ids.session6,
    scenarioId: ids.scenarioBackend,
    rubricId: ids.rubricBackend,
    candidateId: ids.profileCharlie,
    recruiterId: ids.recruiterBob,
    livekitRoom: 'interview_backend_charlie_2',
    phase: InterviewPhase.CREATED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(0) },
    ],
    scheduledAt: new Date(Date.now() + 259200000), // 3 days from now
    metadata: { language: 'en', timezone: 'America/New_York' },
  },
  {
    id: ids.session7,
    scenarioId: ids.scenarioSystemDesign,
    rubricId: ids.rubricSystemDesign,
    candidateId: ids.profileEvan,
    recruiterId: ids.recruiterAlice,
    livekitRoom: 'interview_systemdesign_evan',
    phase: InterviewPhase.CREATED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(0) },
    ],
    scheduledAt: null,
    metadata: { language: 'en', timezone: 'America/Chicago' },
  },
  {
    id: ids.session8,
    scenarioId: ids.scenarioFrontend,
    rubricId: ids.rubricFrontend,
    candidateId: ids.profileDiana,
    recruiterId: ids.recruiterBob,
    livekitRoom: 'interview_frontend_diana_2',
    phase: InterviewPhase.CANCELLED,
    phaseHistory: [
      { phase: InterviewPhase.CREATED, timestamp: ago(5) },
      { phase: InterviewPhase.WAITING, timestamp: ago(5) },
      { phase: InterviewPhase.CANCELLED, timestamp: ago(4) },
    ],
    scheduledAt: null,
    endedAt: ago(4),
    metadata: { language: 'en', timezone: 'America/New_York', cancelReason: 'Candidate requested reschedule' },
  },
];

// ═══════════════════════════════════════════════════════════
// TURNS (sample transcript data)
// ═══════════════════════════════════════════════════════════
const turns = [
  // Session 1 - Backend Interview with Charlie
  { id: uuid(), sessionId: ids.session1, index: 0, speakerRole: SpeakerRole.AI, transcript: "Hi Charlie, welcome to your Backend Engineer interview. I'm your AI interviewer today. Let's start with a brief introduction — can you tell me about your experience with backend development?", sttLatencyMs: null, llmTtftMs: 320, ttsFirstAudioMs: 180, e2eLatencyMs: 500, tokensUsed: 45, startedAt: ago(14) },
  { id: uuid(), sessionId: ids.session1, index: 1, speakerRole: SpeakerRole.CANDIDATE, transcript: "Sure! I've been working as a backend engineer for about 4 years now. Most of my experience is with Node.js and TypeScript. At my last company, I led a migration from a monolithic Express app to a microservices architecture using NestJS and PostgreSQL. I've also worked with Redis for caching and BullMQ for job queues.", sttLatencyMs: 150, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 150, tokensUsed: 85, startedAt: new Date(ago(14).getTime() + 30_000) },
  { id: uuid(), sessionId: ids.session1, index: 2, speakerRole: SpeakerRole.AI, transcript: "Great background! Let's dive into a technical question. How would you design a multi-tenant SaaS API with proper authentication, rate limiting, and API versioning?", sttLatencyMs: null, llmTtftMs: 280, ttsFirstAudioMs: 170, e2eLatencyMs: 450, tokensUsed: 38, startedAt: new Date(ago(14).getTime() + 60_000) },
  { id: uuid(), sessionId: ids.session1, index: 3, speakerRole: SpeakerRole.CANDIDATE, transcript: "For authentication, I'd use JWT tokens with short expiration times and refresh tokens. Each tenant would have a unique API key for server-to-server communication. For rate limiting, I'd implement a sliding window approach using Redis, with different tiers per tenant plan. API versioning — I prefer URL-based versioning like /v1/resources because it's the most explicit and cacheable approach. I'd also use a deprecation header to notify clients of upcoming version sunsets.", sttLatencyMs: 140, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 140, tokensUsed: 110, startedAt: new Date(ago(14).getTime() + 120_000) },
  { id: uuid(), sessionId: ids.session1, index: 4, speakerRole: SpeakerRole.AI, transcript: "Excellent approach! Now let's talk about database optimization. If you have a slow PostgreSQL query, what's your systematic approach to diagnosing and fixing it?", sttLatencyMs: null, llmTtftMs: 260, ttsFirstAudioMs: 160, e2eLatencyMs: 420, tokensUsed: 35, startedAt: new Date(ago(14).getTime() + 180_000) },
  { id: uuid(), sessionId: ids.session1, index: 5, speakerRole: SpeakerRole.CANDIDATE, transcript: "First, I'd use EXPLAIN ANALYZE to understand the query plan. Common issues I look for are sequential scans on large tables, missing indexes, and inefficient joins. I'd check if the right composite indexes exist for the WHERE and JOIN clauses. Sometimes denormalization or materialized views help for read-heavy queries. I've also used pg_stat_statements to identify the most expensive queries in production. For really complex cases, I've partitioned tables by date range to reduce scan size.", sttLatencyMs: 160, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 160, tokensUsed: 120, startedAt: new Date(ago(14).getTime() + 260_000) },
  { id: uuid(), sessionId: ids.session1, index: 6, speakerRole: SpeakerRole.AI, transcript: "Great answer! One more question — how do you approach testing in a backend application? What types of tests do you write and what's your target coverage?", sttLatencyMs: null, llmTtftMs: 240, ttsFirstAudioMs: 150, e2eLatencyMs: 390, tokensUsed: 32, startedAt: new Date(ago(14).getTime() + 320_000) },
  { id: uuid(), sessionId: ids.session1, index: 7, speakerRole: SpeakerRole.CANDIDATE, transcript: "I follow the testing pyramid. Unit tests for business logic and utilities — these are fast and isolated with mocked dependencies. Integration tests for the API endpoints using a real test database with Prisma migrations applied. I also write contract tests for external service integrations. For critical flows like authentication and payments, I add end-to-end tests. I aim for at least 80% coverage on business logic but I focus on meaningful coverage, not just hitting a number.", sttLatencyMs: 145, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 145, tokensUsed: 115, startedAt: new Date(ago(14).getTime() + 390_000) },
];

// ═══════════════════════════════════════════════════════════
// SCORECARDS
// ═══════════════════════════════════════════════════════════
const scorecards = [
  {
    id: ids.scorecard1,
    sessionId: ids.session1,
    overallScore: 38,
    maxPossibleScore: 50,
    normalizedScore: 76,
    recommendation: Recommendation.YES,
    evaluatedBy: 'gpt-4o-mini',
    evaluatedAt: new Date(ago(14).getTime() + 4200000),
    criteria: [
      { name: 'Technical Depth', description: 'Demonstrates deep understanding of backend concepts', score: 9, maxScore: 10, weight: 0.3, evidence: 'Discussed microservices migration, Redis caching, and PostgreSQL optimization with specific examples.', reasoning: 'Showed strong technical depth with real-world experience.', order: 0 },
      { name: 'Problem Solving', description: 'Approaches problems systematically', score: 8, maxScore: 10, weight: 0.25, evidence: 'Systematic approach to API design with clear reasoning for each decision.', reasoning: 'Well-structured problem-solving approach.', order: 1 },
      { name: 'Communication', description: 'Explains technical concepts clearly', score: 8, maxScore: 10, weight: 0.25, evidence: 'Clear, structured responses throughout the interview.', reasoning: 'Well-organized answers with concrete examples. Occasionally could be more concise.', order: 2 },
      { name: 'Best Practices', description: 'Follows industry best practices', score: 8, maxScore: 10, weight: 0.2, evidence: 'Mentioned testing pyramid, EXPLAIN ANALYZE, and API versioning strategies.', reasoning: 'Strong awareness of best practices.', order: 3 },
    ],
  },
  {
    id: ids.scorecard2,
    sessionId: ids.session2,
    overallScore: 42,
    maxPossibleScore: 50,
    normalizedScore: 84,
    recommendation: Recommendation.STRONG_YES,
    evaluatedBy: 'gpt-4o-mini',
    evaluatedAt: new Date(ago(12).getTime() + 3600000),
    criteria: [
      { name: 'React Proficiency', description: 'Strong understanding of React patterns', score: 9, maxScore: 10, weight: 0.3, evidence: 'Discussed advanced React patterns including memo, useMemo, and useCallback.', reasoning: 'Excellent React knowledge demonstrated.', order: 0 },
      { name: 'CSS & Design', description: 'Creates visually appealing and responsive UIs', score: 9, maxScore: 10, weight: 0.25, evidence: 'Built component library with Tailwind CSS and Storybook.', reasoning: 'Strong design system experience.', order: 1 },
      { name: 'Accessibility', description: 'Implements accessible components', score: 8, maxScore: 10, weight: 0.25, evidence: 'Mentioned semantic HTML, ARIA labels, keyboard navigation, and WCAG compliance.', reasoning: 'Good accessibility knowledge with practical experience.', order: 2 },
      { name: 'Performance', description: 'Optimizes for performance', score: 8, maxScore: 10, weight: 0.2, evidence: 'Discussed virtualization, code splitting, and memoization strategies.', reasoning: 'Solid performance optimization skills.', order: 3 },
    ],
  },
  {
    id: ids.scorecard3,
    sessionId: ids.session3,
    overallScore: 44,
    maxPossibleScore: 50,
    normalizedScore: 88,
    recommendation: Recommendation.STRONG_YES,
    evaluatedBy: 'gpt-4o-mini',
    evaluatedAt: new Date(ago(10).getTime() + 5400000),
    criteria: [
      { name: 'System Design', description: 'Designs scalable and maintainable systems', score: 9, maxScore: 10, weight: 0.3, evidence: 'Proposed CRDT-based architecture with WebSocket sync and IndexedDB caching.', reasoning: 'Excellent system design skills with modern approaches.', order: 0 },
      { name: 'Technical Breadth', description: 'Demonstrates knowledge across the stack', score: 9, maxScore: 10, weight: 0.25, evidence: 'Discussed frontend, backend, and infrastructure considerations.', reasoning: 'Strong full-stack knowledge.', order: 1 },
      { name: 'Problem Solving', description: 'Approaches problems systematically', score: 9, maxScore: 10, weight: 0.25, evidence: 'Broke down complex problem into manageable components.', reasoning: 'Excellent problem decomposition.', order: 2 },
      { name: 'Communication', description: 'Explains technical concepts clearly', score: 8, maxScore: 10, weight: 0.2, evidence: 'Clear explanations with concrete examples from past experience.', reasoning: 'Strong communication with minor room for improvement.', order: 3 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════
const reports = [
  {
    id: ids.report1,
    sessionId: ids.session1,
    scoreCardId: ids.scorecard1,
    pdfUrl: '/reports/backend-charlie-76.pdf',
    summary: 'Charlie demonstrated strong backend engineering skills with 4 years of practical experience. Key strengths include microservices architecture, database optimization, and testing best practices. Recommended for hire for mid-to-senior backend roles.',
    metadata: { generatorVersion: '1.0.0', modelUsed: 'gpt-4o-mini', templateUsed: 'backend-standard' },
    generatedAt: new Date(ago(14).getTime() + 5400000),
  },
];

// ═══════════════════════════════════════════════════════════
// MODEL CONFIG
// ═══════════════════════════════════════════════════════════
const modelConfigs = [
  {
    id: ids.modelConfig,
    name: 'Default Configuration',
    sttProvider: 'deepgram',
    sttModel: 'nova-2',
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    ttsProvider: 'openai',
    ttsVoice: 'alloy',
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
    isDefault: true,
    isActive: true,
    config: {
      deepgram: { language: 'en', detectLanguage: true },
      openai: { temperature: 0.7, maxTokens: 500 },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('🌱 Seeding database...\n');

  // Delete existing data (in reverse dependency order)
  console.log('  Clearing existing data...');
  await prisma.report.deleteMany();
  await prisma.scoreCard.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.rubricCriterion.deleteMany();
  await prisma.rubric.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.recruiterProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.modelConfig.deleteMany();

  // Create users
  console.log('  Creating users...');
  await prisma.user.createMany({ data: users });

  // Create recruiter profiles
  console.log('  Creating recruiter profiles...');
  await prisma.recruiterProfile.createMany({ data: recruiterProfiles });

  // Create candidate profiles
  console.log('  Creating candidate profiles...');
  await prisma.candidateProfile.createMany({ data: candidateProfiles });

  // Create scenarios
  console.log('  Creating scenarios...');
  await prisma.scenario.createMany({ data: scenarios });

  // Create rubrics with criteria
  console.log('  Creating rubrics...');
  for (const rubric of rubrics) {
    const { criteria, ...rubricData } = rubric;
    await prisma.rubric.create({
      data: {
        ...rubricData,
        criteria: {
          create: criteria.map((c, i) => ({
            name: c.name,
            description: c.description,
            maxScore: c.maxScore,
            weight: c.weight,
            order: c.order,
          })),
        },
      },
    });
  }

  // Create interview sessions
  console.log('  Creating interview sessions...');
  await prisma.interviewSession.createMany({ data: sessions });

  // Create turns
  console.log('  Creating turns...');
  await prisma.turn.createMany({ data: turns });

  // Create scorecards with criteria
  console.log('  Creating scorecards...');
  for (const scorecard of scorecards) {
    const { criteria, ...scorecardData } = scorecard;
    await prisma.scoreCard.create({
      data: {
        ...scorecardData,
        criteria: {
          create: criteria.map((c) => ({
            name: c.name,
            description: c.description,
            score: c.score,
            maxScore: c.maxScore,
            weight: c.weight,
            evidence: c.evidence,
            reasoning: c.reasoning,
            order: c.order,
          })),
        },
      },
    });
  }

  // Create reports
  console.log('  Creating reports...');
  await prisma.report.createMany({ data: reports });

  // Create model config
  console.log('  Creating model config...');
  await prisma.modelConfig.create({ data: modelConfigs[0] });

  console.log('\n✅ Seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log('  Users:              8 (1 admin, 2 recruiters, 5 candidates)');
  console.log('  Recruiter Profiles: 2');
  console.log('  Candidate Profiles: 5');
  console.log('  Scenarios:          6');
  console.log('  Rubrics:            6 (with 4 criteria each = 24 total criteria)');
  console.log('  Interview Sessions: 8 (3 completed, 1 waiting, 1 scheduled, 2 created, 1 cancelled)');
  console.log('  Turns:              8 (sample transcript data)');
  console.log('  Scorecards:         3');
  console.log('  Reports:            1');
  console.log('  Model Configs:      1\n');
  console.log('📧 Test credentials (all passwords: "password123"):');
  console.log('  Admin:     admin@smarthirink.com');
  console.log('  Recruiter: alice.nguyen@smarthirink.com');
  console.log('  Recruiter: bob.tran@smarthirink.com');
  console.log('  Candidate: charlie.le@example.com');
  console.log('  Candidate: diana.pham@example.com');
  console.log('  Candidate: evan.vo@example.com');
  console.log('  Candidate: fiona.hoang@example.com');
  console.log('  Candidate: george.do@example.com\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
