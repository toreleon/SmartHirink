/**
 * SmartHirink – Database Seed Script
 *
 * Creates realistic template data for demonstration and development:
 *   - 1 Admin, 2 Recruiters, 5 Candidates (with profiles)
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

import { PrismaClient, UserRole, InterviewPhase } from '@prisma/client';
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
    passwordHash: PASSWORD_HASH,
    fullName: 'System Admin',
    role: UserRole.ADMIN,
    createdAt: ago(60),
  },
  {
    id: ids.recruiterAlice,
    email: 'alice.nguyen@smarthirink.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Alice Nguyen',
    role: UserRole.RECRUITER,
    createdAt: ago(45),
  },
  {
    id: ids.recruiterBob,
    email: 'bob.tran@smarthirink.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Bob Tran',
    role: UserRole.RECRUITER,
    createdAt: ago(40),
  },
  {
    id: ids.candidateCharlie,
    email: 'charlie.le@example.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Charlie Le',
    role: UserRole.CANDIDATE,
    createdAt: ago(30),
  },
  {
    id: ids.candidateDiana,
    email: 'diana.pham@example.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Diana Pham',
    role: UserRole.CANDIDATE,
    createdAt: ago(28),
  },
  {
    id: ids.candidateEvan,
    email: 'evan.vo@example.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Evan Vo',
    role: UserRole.CANDIDATE,
    createdAt: ago(25),
  },
  {
    id: ids.candidateFiona,
    email: 'fiona.hoang@example.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'Fiona Hoang',
    role: UserRole.CANDIDATE,
    createdAt: ago(20),
  },
  {
    id: ids.candidateGeorge,
    email: 'george.do@example.com',
    passwordHash: PASSWORD_HASH,
    fullName: 'George Do',
    role: UserRole.CANDIDATE,
    createdAt: ago(18),
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
    phone: '+84 901 234 567',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    experienceYears: 4,
    resumeText:
      'Backend engineer with 4 years of experience building scalable REST and GraphQL APIs. Proficient in Node.js, TypeScript, and cloud infrastructure. Led migration from monolith to microservices at previous company.',
  },
  {
    id: ids.profileDiana,
    userId: ids.candidateDiana,
    fullName: 'Diana Pham',
    email: 'diana.pham@example.com',
    phone: '+84 902 345 678',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Figma'],
    experienceYears: 3,
    resumeText:
      'Frontend developer passionate about building performant user interfaces. 3 years of experience with React ecosystem. Contributed to open-source component libraries and built design systems from scratch.',
  },
  {
    id: ids.profileEvan,
    userId: ids.candidateEvan,
    fullName: 'Evan Vo',
    email: 'evan.vo@example.com',
    phone: '+84 903 456 789',
    skills: ['React', 'Node.js', 'Python', 'MongoDB', 'GraphQL', 'Kubernetes'],
    experienceYears: 6,
    resumeText:
      'Full-stack engineer with 6 years of experience across multiple stacks. Built and deployed applications serving millions of users. Strong background in system design and distributed systems.',
  },
  {
    id: ids.profileFiona,
    userId: ids.candidateFiona,
    fullName: 'Fiona Hoang',
    email: 'fiona.hoang@example.com',
    phone: '+84 904 567 890',
    skills: ['Terraform', 'AWS', 'Kubernetes', 'Docker', 'CI/CD', 'Python'],
    experienceYears: 5,
    resumeText:
      'DevOps/SRE engineer with 5 years of experience managing cloud infrastructure at scale. Expertise in IaC, container orchestration, and observability. Reduced cloud costs by 40% at previous role.',
  },
  {
    id: ids.profileGeorge,
    userId: ids.candidateGeorge,
    fullName: 'George Do',
    email: 'george.do@example.com',
    phone: '+84 905 678 901',
    skills: ['Python', 'Apache Spark', 'SQL', 'Airflow', 'dbt', 'AWS Redshift'],
    experienceYears: 3,
    resumeText:
      'Data engineer with 3 years of experience building ETL pipelines and data warehouses. Proficient in Python, SQL, and modern data stack. Built real-time analytics pipeline processing 10M+ events/day.',
  },
];

// ═══════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════
const scenarios = [
  {
    id: ids.scenarioBackend,
    title: 'Backend Engineer Interview',
    description:
      'Assess the candidate on server-side development skills including API design, database optimization, caching strategies, and microservices architecture. Focus on practical experience with Node.js/TypeScript ecosystem.',
    position: 'Backend Engineer',
    level: 'MID',
    domain: 'Software Engineering',
    topics: ['Node.js', 'TypeScript', 'REST API Design', 'PostgreSQL', 'Caching', 'Testing'],
    questionCount: 10,
    durationMinutes: 30,
    createdById: ids.recruiterAlice,
    createdAt: ago(30),
  },
  {
    id: ids.scenarioFrontend,
    title: 'Frontend Developer Interview',
    description:
      'Evaluate frontend development expertise including modern React patterns, state management, performance optimization, accessibility, and responsive design. Emphasis on component architecture and testing.',
    position: 'Frontend Developer',
    level: 'MID',
    domain: 'Software Engineering',
    topics: ['React', 'TypeScript', 'CSS/Tailwind', 'State Management', 'Performance', 'Accessibility'],
    questionCount: 10,
    durationMinutes: 30,
    createdById: ids.recruiterAlice,
    createdAt: ago(28),
  },
  {
    id: ids.scenarioFullstack,
    title: 'Senior Full-Stack Engineer Interview',
    description:
      'Comprehensive assessment for senior full-stack engineers covering system design, architecture decisions, frontend/backend integration, DevOps practices, and technical leadership. Expect depth in at least one area.',
    position: 'Senior Full-Stack Engineer',
    level: 'SENIOR',
    domain: 'Software Engineering',
    topics: ['System Design', 'React', 'Node.js', 'Databases', 'Architecture', 'Leadership'],
    questionCount: 12,
    durationMinutes: 45,
    createdById: ids.recruiterAlice,
    createdAt: ago(25),
  },
  {
    id: ids.scenarioDevops,
    title: 'DevOps / SRE Engineer Interview',
    description:
      'Assess infrastructure and operations expertise including CI/CD pipeline design, container orchestration, infrastructure as code, monitoring/alerting, and incident response practices.',
    position: 'DevOps Engineer',
    level: 'MID',
    domain: 'Infrastructure',
    topics: ['Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Monitoring', 'Cloud (AWS/GCP)'],
    questionCount: 10,
    durationMinutes: 30,
    createdById: ids.recruiterBob,
    createdAt: ago(22),
  },
  {
    id: ids.scenarioDataEng,
    title: 'Data Engineer Interview',
    description:
      'Evaluate data engineering skills including ETL/ELT pipeline design, data modeling, warehouse architecture, real-time vs batch processing, and data quality assurance.',
    position: 'Data Engineer',
    level: 'JUNIOR',
    domain: 'Data Engineering',
    topics: ['SQL', 'Python', 'ETL Pipelines', 'Data Modeling', 'Apache Spark', 'dbt'],
    questionCount: 8,
    durationMinutes: 25,
    createdById: ids.recruiterBob,
    createdAt: ago(18),
  },
  {
    id: ids.scenarioSystemDesign,
    title: 'System Design Interview — Staff Level',
    description:
      'Deep-dive system design interview for staff-level candidates. Expect questions on designing large-scale distributed systems, handling trade-offs, capacity estimation, and real-world production considerations.',
    position: 'Staff Software Engineer',
    level: 'LEAD',
    domain: 'Software Engineering',
    topics: ['Distributed Systems', 'Scalability', 'CAP Theorem', 'Load Balancing', 'Caching', 'Message Queues'],
    questionCount: 6,
    durationMinutes: 60,
    createdById: ids.recruiterAlice,
    createdAt: ago(15),
  },
];

// ═══════════════════════════════════════════════════════════
// RUBRICS & CRITERIA
// ═══════════════════════════════════════════════════════════
interface CriterionInput {
  id: string;
  rubricId: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

interface RubricInput {
  id: string;
  scenarioId: string;
  createdAt: Date;
  criteria: CriterionInput[];
}

const rubrics: RubricInput[] = [
  {
    id: ids.rubricBackend,
    scenarioId: ids.scenarioBackend,
    createdAt: ago(30),
    criteria: [
      { id: uuid(), rubricId: ids.rubricBackend, name: 'API Design', description: 'Ability to design clean, RESTful APIs with proper status codes, pagination, and versioning', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricBackend, name: 'Database Knowledge', description: 'Understanding of relational databases, indexing, query optimization, and data modeling', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricBackend, name: 'Error Handling & Testing', description: 'Approach to error handling, input validation, and testing strategies (unit, integration)', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricBackend, name: 'System Design Awareness', description: 'Understanding of caching, message queues, and scalability patterns for backend systems', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricBackend, name: 'Communication', description: 'Clarity of explanation, structured thinking, and ability to articulate technical decisions', maxScore: 10, weight: 0.1 },
    ],
  },
  {
    id: ids.rubricFrontend,
    scenarioId: ids.scenarioFrontend,
    createdAt: ago(28),
    criteria: [
      { id: uuid(), rubricId: ids.rubricFrontend, name: 'React Proficiency', description: 'Understanding of React hooks, component lifecycle, rendering optimization, and patterns', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricFrontend, name: 'State Management', description: 'Ability to choose and implement appropriate state management solutions', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFrontend, name: 'CSS & Layout', description: 'Proficiency in CSS, responsive design, and modern layout techniques (Flexbox, Grid)', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFrontend, name: 'Performance & Accessibility', description: 'Knowledge of web performance optimization, Core Web Vitals, and WCAG accessibility standards', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFrontend, name: 'Testing & Tooling', description: 'Experience with frontend testing (Jest, Testing Library, Cypress) and build tools', maxScore: 10, weight: 0.15 },
    ],
  },
  {
    id: ids.rubricFullstack,
    scenarioId: ids.scenarioFullstack,
    createdAt: ago(25),
    criteria: [
      { id: uuid(), rubricId: ids.rubricFullstack, name: 'Architecture & Design', description: 'Ability to make sound architectural decisions and explain trade-offs across the stack', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricFullstack, name: 'Frontend Depth', description: 'Deep knowledge of frontend frameworks, rendering strategies, and UX best practices', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFullstack, name: 'Backend Depth', description: 'Strong server-side skills including API design, databases, and infrastructure concerns', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFullstack, name: 'Technical Leadership', description: 'Experience mentoring, leading technical projects, and making cross-team decisions', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricFullstack, name: 'Problem Solving', description: 'Structured approach to breaking down complex problems and identifying solutions', maxScore: 10, weight: 0.15 },
    ],
  },
  {
    id: ids.rubricDevops,
    scenarioId: ids.scenarioDevops,
    createdAt: ago(22),
    criteria: [
      { id: uuid(), rubricId: ids.rubricDevops, name: 'CI/CD & Automation', description: 'Experience designing and maintaining CI/CD pipelines with automated testing and deployment', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricDevops, name: 'Container Orchestration', description: 'Proficiency with Docker and Kubernetes including deployment strategies and troubleshooting', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricDevops, name: 'Infrastructure as Code', description: 'Experience with Terraform, CloudFormation, or Pulumi for managing cloud infrastructure', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricDevops, name: 'Monitoring & Incident Response', description: 'Knowledge of observability tools, alerting strategies, and incident management processes', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricDevops, name: 'Security Practices', description: 'Understanding of security best practices, secrets management, and network policies', maxScore: 10, weight: 0.1 },
    ],
  },
  {
    id: ids.rubricDataEng,
    scenarioId: ids.scenarioDataEng,
    createdAt: ago(18),
    criteria: [
      { id: uuid(), rubricId: ids.rubricDataEng, name: 'SQL Proficiency', description: 'Ability to write complex SQL queries including window functions, CTEs, and optimization', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricDataEng, name: 'Pipeline Design', description: 'Understanding of ETL/ELT patterns, data orchestration, and pipeline monitoring', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricDataEng, name: 'Data Modeling', description: 'Knowledge of dimensional modeling, star/snowflake schemas, and normalization trade-offs', maxScore: 10, weight: 0.2 },
      { id: uuid(), rubricId: ids.rubricDataEng, name: 'Data Quality', description: 'Approach to data validation, testing, and ensuring data reliability', maxScore: 10, weight: 0.15 },
      { id: uuid(), rubricId: ids.rubricDataEng, name: 'Tools & Ecosystem', description: 'Familiarity with modern data stack tools (Spark, Airflow, dbt, data warehouses)', maxScore: 10, weight: 0.15 },
    ],
  },
  {
    id: ids.rubricSystemDesign,
    scenarioId: ids.scenarioSystemDesign,
    createdAt: ago(15),
    criteria: [
      { id: uuid(), rubricId: ids.rubricSystemDesign, name: 'Requirements Clarification', description: 'Ability to ask clarifying questions, define scope, and identify functional/non-functional requirements', maxScore: 10, weight: 0.15 },
      { id: uuid(), rubricId: ids.rubricSystemDesign, name: 'High-Level Design', description: 'Ability to produce a clear, well-structured system architecture with appropriate components', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricSystemDesign, name: 'Deep Dive', description: 'Depth of knowledge when drilling into specific components like databases, caching, or messaging', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricSystemDesign, name: 'Scalability & Trade-offs', description: 'Understanding of horizontal scaling, consistency trade-offs, and capacity estimation', maxScore: 10, weight: 0.25 },
      { id: uuid(), rubricId: ids.rubricSystemDesign, name: 'Communication', description: 'Ability to clearly present and justify design decisions throughout the discussion', maxScore: 10, weight: 0.1 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// INTERVIEW SESSIONS
// ═══════════════════════════════════════════════════════════
const sessions = [
  // Session 1: COMPLETED — Charlie × Backend (scored)
  {
    id: ids.session1,
    scenarioId: ids.scenarioBackend,
    rubricId: ids.rubricBackend,
    candidateId: ids.profileCharlie,
    recruiterId: ids.recruiterAlice,
    livekitRoom: `room_${ids.session1.slice(0, 8)}`,
    phase: InterviewPhase.COMPLETED,
    startedAt: ago(14),
    endedAt: new Date(ago(14).getTime() + 28 * 60_000),
    createdAt: ago(14),
  },
  // Session 2: COMPLETED — Diana × Frontend (scored)
  {
    id: ids.session2,
    scenarioId: ids.scenarioFrontend,
    rubricId: ids.rubricFrontend,
    candidateId: ids.profileDiana,
    recruiterId: ids.recruiterAlice,
    livekitRoom: `room_${ids.session2.slice(0, 8)}`,
    phase: InterviewPhase.COMPLETED,
    startedAt: ago(12),
    endedAt: new Date(ago(12).getTime() + 32 * 60_000),
    createdAt: ago(12),
  },
  // Session 3: COMPLETED — Evan × Fullstack (scored)
  {
    id: ids.session3,
    scenarioId: ids.scenarioFullstack,
    rubricId: ids.rubricFullstack,
    candidateId: ids.profileEvan,
    recruiterId: ids.recruiterAlice,
    livekitRoom: `room_${ids.session3.slice(0, 8)}`,
    phase: InterviewPhase.COMPLETED,
    startedAt: ago(10),
    endedAt: new Date(ago(10).getTime() + 42 * 60_000),
    createdAt: ago(10),
  },
  // Session 4: QUESTIONING — Fiona × DevOps (in-progress)
  {
    id: ids.session4,
    scenarioId: ids.scenarioDevops,
    rubricId: ids.rubricDevops,
    candidateId: ids.profileFiona,
    recruiterId: ids.recruiterBob,
    livekitRoom: `room_${ids.session4.slice(0, 8)}`,
    phase: InterviewPhase.QUESTIONING,
    startedAt: ago(1),
    createdAt: ago(1),
  },
  // Session 5: WAITING — George × Data Eng (pending join)
  {
    id: ids.session5,
    scenarioId: ids.scenarioDataEng,
    rubricId: ids.rubricDataEng,
    candidateId: ids.profileGeorge,
    recruiterId: ids.recruiterBob,
    livekitRoom: `room_${ids.session5.slice(0, 8)}`,
    phase: InterviewPhase.WAITING,
    createdAt: ago(2),
  },
  // Session 6: CREATED — Charlie × System Design (not started)
  {
    id: ids.session6,
    scenarioId: ids.scenarioSystemDesign,
    rubricId: ids.rubricSystemDesign,
    candidateId: ids.profileCharlie,
    recruiterId: ids.recruiterAlice,
    livekitRoom: `room_${ids.session6.slice(0, 8)}`,
    phase: InterviewPhase.CREATED,
    createdAt: ago(1),
  },
  // Session 7: CREATED — Diana × Fullstack (not started)
  {
    id: ids.session7,
    scenarioId: ids.scenarioFullstack,
    rubricId: ids.rubricFullstack,
    candidateId: ids.profileDiana,
    recruiterId: ids.recruiterAlice,
    livekitRoom: `room_${ids.session7.slice(0, 8)}`,
    phase: InterviewPhase.CREATED,
    createdAt: ago(0),
  },
  // Session 8: CANCELLED — Evan × DevOps (cancelled)
  {
    id: ids.session8,
    scenarioId: ids.scenarioDevops,
    rubricId: ids.rubricDevops,
    candidateId: ids.profileEvan,
    recruiterId: ids.recruiterBob,
    livekitRoom: `room_${ids.session8.slice(0, 8)}`,
    phase: InterviewPhase.CANCELLED,
    createdAt: ago(8),
  },
];

// ═══════════════════════════════════════════════════════════
// TURNS (sample transcript data for completed sessions)
// ═══════════════════════════════════════════════════════════
const turns = [
  // ── Session 1 (Backend — Charlie) ──────────────────────
  { id: uuid(), sessionId: ids.session1, index: 0, speakerRole: 'AI', transcript: "Hi Charlie, welcome to your Backend Engineer interview. I'm your AI interviewer today. Let's start with a brief introduction — can you tell me about your experience with backend development?", sttLatencyMs: null, llmTtftMs: 320, ttsFirstAudioMs: 180, e2eLatencyMs: 500, startedAt: ago(14) },
  { id: uuid(), sessionId: ids.session1, index: 1, speakerRole: 'CANDIDATE', transcript: "Sure! I've been working as a backend engineer for about 4 years now. Most of my experience is with Node.js and TypeScript. At my last company, I led a migration from a monolithic Express app to a microservices architecture using NestJS and PostgreSQL. I've also worked with Redis for caching and BullMQ for job queues.", sttLatencyMs: 150, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 150, startedAt: new Date(ago(14).getTime() + 30_000) },
  { id: uuid(), sessionId: ids.session1, index: 2, speakerRole: 'AI', transcript: "That's great experience. Let's dive into API design. If you were designing a REST API for a multi-tenant SaaS application, how would you handle authentication, rate limiting, and API versioning?", sttLatencyMs: null, llmTtftMs: 280, ttsFirstAudioMs: 200, e2eLatencyMs: 480, startedAt: new Date(ago(14).getTime() + 90_000) },
  { id: uuid(), sessionId: ids.session1, index: 3, speakerRole: 'CANDIDATE', transcript: "For authentication, I'd use JWT tokens with short expiration times and refresh tokens. Each tenant would have a unique API key for server-to-server communication. For rate limiting, I'd implement a sliding window approach using Redis, with different tiers per tenant plan. API versioning — I prefer URL-based versioning like /v1/resources because it's the most explicit and cacheable approach. I'd also use a deprecation header to notify clients of upcoming version sunsets.", sttLatencyMs: 140, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 140, startedAt: new Date(ago(14).getTime() + 120_000) },
  { id: uuid(), sessionId: ids.session1, index: 4, speakerRole: 'AI', transcript: "Excellent answer. Now let's talk about databases. You mentioned PostgreSQL — can you walk me through how you would optimize a slow query that involves joining multiple large tables?", sttLatencyMs: null, llmTtftMs: 250, ttsFirstAudioMs: 190, e2eLatencyMs: 440, startedAt: new Date(ago(14).getTime() + 210_000) },
  { id: uuid(), sessionId: ids.session1, index: 5, speakerRole: 'CANDIDATE', transcript: "First, I'd use EXPLAIN ANALYZE to understand the query plan. Common issues I look for are sequential scans on large tables, missing indexes, and inefficient joins. I'd check if the right composite indexes exist for the WHERE and JOIN clauses. Sometimes denormalization or materialized views help for read-heavy queries. I've also used pg_stat_statements to identify the most expensive queries in production. For really complex cases, I've partitioned tables by date range to reduce scan size.", sttLatencyMs: 160, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 160, startedAt: new Date(ago(14).getTime() + 260_000) },
  { id: uuid(), sessionId: ids.session1, index: 6, speakerRole: 'AI', transcript: "Great. Let's move to testing. How do you approach testing a backend API? What's your testing strategy?", sttLatencyMs: null, llmTtftMs: 200, ttsFirstAudioMs: 170, e2eLatencyMs: 370, startedAt: new Date(ago(14).getTime() + 350_000) },
  { id: uuid(), sessionId: ids.session1, index: 7, speakerRole: 'CANDIDATE', transcript: "I follow the testing pyramid. Unit tests for business logic and utilities — these are fast and isolated with mocked dependencies. Integration tests for the API endpoints using a real test database with Prisma migrations applied. I also write contract tests for external service integrations. For critical flows like authentication and payments, I add end-to-end tests. I aim for at least 80% coverage on business logic but I focus on meaningful coverage, not just hitting a number.", sttLatencyMs: 145, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 145, startedAt: new Date(ago(14).getTime() + 390_000) },

  // ── Session 2 (Frontend — Diana) ───────────────────────
  { id: uuid(), sessionId: ids.session2, index: 0, speakerRole: 'AI', transcript: "Hello Diana, welcome! Let's start your Frontend Developer interview. Can you give me an overview of your frontend experience?", sttLatencyMs: null, llmTtftMs: 300, ttsFirstAudioMs: 190, e2eLatencyMs: 490, startedAt: ago(12) },
  { id: uuid(), sessionId: ids.session2, index: 1, speakerRole: 'CANDIDATE', transcript: "Hi! I've been doing frontend development for 3 years, primarily with React and TypeScript. I've built several production applications using Next.js, and I'm passionate about design systems — I built a component library with Tailwind CSS and Storybook at my last company that's used across 4 product teams.", sttLatencyMs: 130, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 130, startedAt: new Date(ago(12).getTime() + 25_000) },
  { id: uuid(), sessionId: ids.session2, index: 2, speakerRole: 'AI', transcript: "Interesting! Let's talk about React performance. What strategies would you use to optimize a large React application that's experiencing slow renders?", sttLatencyMs: null, llmTtftMs: 270, ttsFirstAudioMs: 185, e2eLatencyMs: 455, startedAt: new Date(ago(12).getTime() + 80_000) },
  { id: uuid(), sessionId: ids.session2, index: 3, speakerRole: 'CANDIDATE', transcript: "First, I'd use React DevTools Profiler to identify which components are re-rendering unnecessarily. Common fixes include using React.memo for pure components, useMemo and useCallback for expensive computations and callbacks. I'd also look at state management — lifting state up too high causes cascading re-renders, so I'd colocate state where possible or use a library like Zustand for fine-grained subscriptions. For lists, I'd use virtualization with react-window. Code splitting with dynamic imports and Suspense helps with initial load time.", sttLatencyMs: 155, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 155, startedAt: new Date(ago(12).getTime() + 115_000) },
  { id: uuid(), sessionId: ids.session2, index: 4, speakerRole: 'AI', transcript: "Great knowledge of optimization techniques. Now, how do you approach accessibility in your frontend applications?", sttLatencyMs: null, llmTtftMs: 230, ttsFirstAudioMs: 175, e2eLatencyMs: 405, startedAt: new Date(ago(12).getTime() + 200_000) },
  { id: uuid(), sessionId: ids.session2, index: 5, speakerRole: 'CANDIDATE', transcript: "Accessibility is something I build in from the start, not bolt on later. I use semantic HTML elements — nav, main, article, button instead of clickable divs. I ensure proper heading hierarchy and ARIA labels where semantic HTML isn't enough. All interactive elements need to be keyboard navigable. I test with screen readers like VoiceOver and use axe-core in our CI pipeline to catch regressions. I follow WCAG 2.1 AA as the minimum standard and I've trained my team on accessibility best practices.", sttLatencyMs: 140, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 140, startedAt: new Date(ago(12).getTime() + 240_000) },

  // ── Session 3 (Fullstack — Evan) ───────────────────────
  { id: uuid(), sessionId: ids.session3, index: 0, speakerRole: 'AI', transcript: "Welcome Evan! This is a Senior Full-Stack Engineer interview. Given your 6 years of experience, let's start with a system design question. How would you architect a real-time collaborative document editor like Google Docs?", sttLatencyMs: null, llmTtftMs: 350, ttsFirstAudioMs: 200, e2eLatencyMs: 550, startedAt: ago(10) },
  { id: uuid(), sessionId: ids.session3, index: 1, speakerRole: 'CANDIDATE', transcript: "Great question! I'd break this into several components. First, the conflict resolution strategy — I'd use CRDTs (Conflict-free Replicated Data Types) or Operational Transform. CRDTs are more modern and handle eventual consistency well. For the real-time sync layer, I'd use WebSockets with a message broker like Redis Pub/Sub for horizontal scaling. The document storage would be a combination of PostgreSQL for metadata and a document store for the actual content with version history. On the frontend, I'd use a rich text editor like TipTap/ProseMirror that has built-in CRDT support.", sttLatencyMs: 165, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 165, startedAt: new Date(ago(10).getTime() + 40_000) },
  { id: uuid(), sessionId: ids.session3, index: 2, speakerRole: 'AI', transcript: "That's a solid high-level architecture. How would you handle the case where a user goes offline and comes back online with changes?", sttLatencyMs: null, llmTtftMs: 260, ttsFirstAudioMs: 180, e2eLatencyMs: 440, startedAt: new Date(ago(10).getTime() + 130_000) },
  { id: uuid(), sessionId: ids.session3, index: 3, speakerRole: 'CANDIDATE', transcript: "This is where CRDTs really shine. The client would maintain a local copy and queue operations while offline. When the connection is restored, it replays the operations to the server. CRDTs guarantee convergence without conflicts — the same set of operations always produces the same result regardless of order. I'd also implement an IndexedDB cache on the client for durability, with a service worker to handle the offline-to-online transition. The sync protocol would use vector clocks to track which operations each client has seen.", sttLatencyMs: 150, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 150, startedAt: new Date(ago(10).getTime() + 170_000) },
  { id: uuid(), sessionId: ids.session3, index: 4, speakerRole: 'AI', transcript: "Impressive depth. Let's switch to leadership. Can you describe a time when you had to make a difficult technical decision that affected multiple teams?", sttLatencyMs: null, llmTtftMs: 240, ttsFirstAudioMs: 175, e2eLatencyMs: 415, startedAt: new Date(ago(10).getTime() + 260_000) },
  { id: uuid(), sessionId: ids.session3, index: 5, speakerRole: 'CANDIDATE', transcript: "At my previous company, we had to decide between migrating to a monorepo or keeping separate repositories for our 8 microservices. I led the technical evaluation — I wrote an RFC, set up a proof of concept with Turborepo, and presented the trade-offs to all 3 engineering teams. The key concern was build times and CI complexity. After analysis, we went with the monorepo because it solved our biggest pain point: coordinating API changes across services. I managed the migration over 6 weeks with zero downtime by using a phased approach. It reduced our PR review time by 40% because reviewers could see the full impact of changes.", sttLatencyMs: 170, llmTtftMs: null, ttsFirstAudioMs: null, e2eLatencyMs: 170, startedAt: new Date(ago(10).getTime() + 310_000) },
];

// ═══════════════════════════════════════════════════════════
// SCORECARDS (for completed sessions)
// ═══════════════════════════════════════════════════════════
const scoreCards = [
  // Session 1 — Charlie Backend: STRONG YES
  {
    id: ids.scorecard1,
    sessionId: ids.session1,
    overallScore: 42.5,
    maxPossibleScore: 50,
    criterionScores: [
      { criterionName: 'API Design', score: 9, maxScore: 10, evidence: 'Demonstrated strong knowledge of REST design, authentication patterns, and versioning strategies.', reasoning: 'Covered JWT + refresh tokens, tenant API keys, rate limiting with Redis, and URL-based versioning with deprecation headers. Comprehensive and production-ready approach.' },
      { criterionName: 'Database Knowledge', score: 8.5, maxScore: 10, evidence: 'Explained EXPLAIN ANALYZE, composite indexes, materialized views, and table partitioning.', reasoning: 'Solid understanding of PostgreSQL optimization techniques. Could have gone deeper into index types (B-tree vs GIN) and connection pooling.' },
      { criterionName: 'Error Handling & Testing', score: 9, maxScore: 10, evidence: 'Described testing pyramid with unit, integration, contract, and E2E tests.', reasoning: 'Mature testing philosophy focusing on meaningful coverage. Mentioned using real test databases and contract tests for external services.' },
      { criterionName: 'System Design Awareness', score: 8, maxScore: 10, evidence: 'Referenced Redis caching, BullMQ queues, and microservices migration experience.', reasoning: 'Good practical experience with distributed patterns. Led a monolith-to-microservices migration which shows real-world understanding.' },
      { criterionName: 'Communication', score: 8, maxScore: 10, evidence: 'Clear, structured responses throughout the interview.', reasoning: 'Well-organized answers with concrete examples. Occasionally could be more concise.' },
    ],
    strengths: [
      'Excellent API design knowledge with practical multi-tenant experience',
      'Strong database optimization skills with real-world PostgreSQL expertise',
      'Mature testing philosophy with comprehensive strategy',
      'Hands-on microservices migration experience',
    ],
    weaknesses: [
      'Could deepen knowledge of advanced database index types',
      'Could provide more quantitative performance metrics from past projects',
    ],
    recommendation: 'STRONG_YES',
    evaluatedAt: new Date(ago(14).getTime() + 35 * 60_000),
  },
  // Session 2 — Diana Frontend: YES
  {
    id: ids.scorecard2,
    sessionId: ids.session2,
    overallScore: 38,
    maxPossibleScore: 50,
    criterionScores: [
      { criterionName: 'React Proficiency', score: 8.5, maxScore: 10, evidence: 'Demonstrated knowledge of React.memo, useMemo, useCallback, and component optimization patterns.', reasoning: 'Strong understanding of React rendering lifecycle and optimization. Mentioned React DevTools Profiler and state colocation.' },
      { criterionName: 'State Management', score: 7.5, maxScore: 10, evidence: 'Mentioned Zustand for fine-grained subscriptions and state colocation principle.', reasoning: 'Good practical knowledge. Could have discussed more patterns like server state management (React Query/SWR) or state machines.' },
      { criterionName: 'CSS & Layout', score: 7, maxScore: 10, evidence: 'Built a Tailwind-based component library used across 4 teams.', reasoning: 'Solid experience with design systems and Tailwind. Did not deeply discuss responsive patterns or CSS architecture (BEM, CSS modules vs. utility-first trade-offs).' },
      { criterionName: 'Performance & Accessibility', score: 8, maxScore: 10, evidence: 'Described semantic HTML, ARIA labels, keyboard navigation, screen reader testing, and axe-core in CI.', reasoning: 'Excellent accessibility knowledge — builds it in from the start rather than as an afterthought. Mentioned WCAG 2.1 AA and team training.' },
      { criterionName: 'Testing & Tooling', score: 7, maxScore: 10, evidence: 'Mentioned Storybook for component development and CI pipeline integration.', reasoning: 'Good tooling experience but did not discuss unit/integration testing frameworks or testing strategies in depth during the interview.' },
    ],
    strengths: [
      'Strong React optimization skills with practical profiling experience',
      'Excellent accessibility-first mindset with WCAG compliance',
      'Design system experience with Storybook and cross-team adoption',
    ],
    weaknesses: [
      'Could deepen state management knowledge (server state patterns)',
      'Limited discussion of CSS architecture trade-offs',
      'Testing strategy needs more depth beyond Storybook',
    ],
    recommendation: 'YES',
    evaluatedAt: new Date(ago(12).getTime() + 38 * 60_000),
  },
  // Session 3 — Evan Fullstack: STRONG YES
  {
    id: ids.scorecard3,
    sessionId: ids.session3,
    overallScore: 45,
    maxPossibleScore: 50,
    criterionScores: [
      { criterionName: 'Architecture & Design', score: 9.5, maxScore: 10, evidence: 'Designed a real-time collaborative editor with CRDTs, WebSocket sync, and offline-first architecture.', reasoning: 'Exceptional system design skills. Deep understanding of CRDTs, vector clocks, and eventual consistency. Production-ready approach with IndexedDB caching and service workers.' },
      { criterionName: 'Frontend Depth', score: 8.5, maxScore: 10, evidence: 'Referenced TipTap/ProseMirror for rich text editing with CRDT support.', reasoning: 'Good knowledge of complex frontend libraries. Could have discussed rendering optimization for large documents.' },
      { criterionName: 'Backend Depth', score: 9, maxScore: 10, evidence: 'Described WebSocket scaling with Redis Pub/Sub, document storage strategy, and version history.', reasoning: 'Strong backend architecture with appropriate technology choices. Good understanding of horizontal scaling patterns.' },
      { criterionName: 'Technical Leadership', score: 9.5, maxScore: 10, evidence: 'Led monorepo migration affecting 3 teams and 8 services — wrote RFC, POC, and managed 6-week phased rollout.', reasoning: 'Outstanding leadership example with measurable impact (40% PR review time reduction). Demonstrated cross-team communication and careful migration planning.' },
      { criterionName: 'Problem Solving', score: 8.5, maxScore: 10, evidence: 'Structured approach to both system design and organizational challenges.', reasoning: 'Excellent at breaking down complex problems. Strong at articulating trade-offs and making data-driven decisions.' },
    ],
    strengths: [
      'Exceptional system design skills with deep distributed systems knowledge',
      'Proven technical leadership with measurable cross-team impact',
      'Strong full-stack depth — equally capable on frontend and backend',
      'Data-driven decision making (RFC, POC, metrics)',
    ],
    weaknesses: [
      'Could provide more depth on frontend performance optimization',
      'Senior role would benefit from discussing mentorship philosophy',
    ],
    recommendation: 'STRONG_YES',
    evaluatedAt: new Date(ago(10).getTime() + 48 * 60_000),
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
    pdfUrl: null, // Would be generated by worker
    generatedAt: new Date(ago(14).getTime() + 40 * 60_000),
  },
];

// ═══════════════════════════════════════════════════════════
// MODEL CONFIG
// ═══════════════════════════════════════════════════════════
const modelConfig = {
  id: ids.modelConfig,
  name: 'default',
  sttProvider: 'deepgram',
  sttModel: 'nova-2',
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  ttsProvider: 'openai',
  ttsVoice: 'alloy',
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  isDefault: true,
};

// ═══════════════════════════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('🌱 Seeding SmartHirink database...\n');

  // Clear existing data (in reverse dependency order)
  console.log('  Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.scoreCard.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.rubricCriterion.deleteMany();
  await prisma.rubric.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.modelConfig.deleteMany();

  // Users
  console.log('  Creating users...');
  await prisma.user.createMany({ data: users });

  // Candidate profiles
  console.log('  Creating candidate profiles...');
  await prisma.candidateProfile.createMany({ data: candidateProfiles });

  // Scenarios
  console.log('  Creating scenarios...');
  await prisma.scenario.createMany({ data: scenarios });

  // Rubrics + criteria
  console.log('  Creating rubrics & criteria...');
  for (const rubric of rubrics) {
    const { criteria, ...rubricData } = rubric;
    await prisma.rubric.create({ data: rubricData });
    await prisma.rubricCriterion.createMany({ data: criteria });
  }

  // Interview sessions
  console.log('  Creating interview sessions...');
  await prisma.interviewSession.createMany({ data: sessions });

  // Turns
  console.log('  Creating transcript turns...');
  await prisma.turn.createMany({ data: turns });

  // Score cards
  console.log('  Creating score cards...');
  for (const sc of scoreCards) {
    await prisma.scoreCard.create({ data: sc });
  }

  // Reports
  console.log('  Creating reports...');
  await prisma.report.createMany({ data: reports });

  // Model config
  console.log('  Creating model config...');
  await prisma.modelConfig.create({ data: modelConfig });

  // Summary
  console.log('\n✅ Seed complete!\n');
  console.log('  Users:              8 (1 admin, 2 recruiters, 5 candidates)');
  console.log('  Candidate Profiles: 5');
  console.log('  Scenarios:          6');
  console.log('  Rubrics:            6 (with 5 criteria each)');
  console.log('  Interview Sessions: 8 (3 completed, 1 in-progress, 1 waiting, 2 created, 1 cancelled)');
  console.log('  Transcript Turns:   20');
  console.log('  Score Cards:        3');
  console.log('  Reports:            1');
  console.log('  Model Configs:      1');
  console.log('\n📧 Login credentials (all accounts):');
  console.log('  Password: password123');
  console.log('  Admin:     admin@smarthirink.com');
  console.log('  Recruiter: alice.nguyen@smarthirink.com');
  console.log('  Recruiter: bob.tran@smarthirink.com');
  console.log('  Candidate: charlie.le@example.com');
  console.log('  Candidate: diana.pham@example.com');
  console.log('  Candidate: evan.vo@example.com');
  console.log('  Candidate: fiona.hoang@example.com');
  console.log('  Candidate: george.do@example.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
