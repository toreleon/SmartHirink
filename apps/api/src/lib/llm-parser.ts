import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy',
  ...(process.env.OPENAI_BASE_URL && { baseURL: process.env.OPENAI_BASE_URL }),
  maxRetries: 3,
  timeout: 60_000,
});

const model = process.env.OPENAI_MODEL || 'gpt-4o';

// ─── CV Structured Output Schemas ───────────────────────────

const WorkExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.nullable(z.string()),
  location: z.nullable(z.string()),
  description: z.string(),
  highlights: z.array(z.string()),
});

const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.nullable(z.string()),
  endDate: z.nullable(z.string()),
  gpa: z.nullable(z.string()),
  honors: z.nullable(z.string()),
});

const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.nullable(z.string()),
  expiryDate: z.nullable(z.string()),
  credentialId: z.nullable(z.string()),
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  url: z.nullable(z.string()),
});

const ParsedCandidateSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.nullable(z.string()),
  skills: z.array(z.string()),
  experienceYears: z.number(),
  headline: z.nullable(z.string()),
  summary: z.nullable(z.string()),
  location: z.nullable(z.string()),
  linkedinUrl: z.nullable(z.string()),
  githubUrl: z.nullable(z.string()),
  portfolioUrl: z.nullable(z.string()),
  languages: z.array(z.string()),
  workExperience: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
  projects: z.array(ProjectSchema),
});

// ─── CV TypeScript Types (inferred from Zod) ────────────────

export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export interface ParsedCandidate extends z.infer<typeof ParsedCandidateSchema> {
  resumeText: string;
}

// ─── CV System Prompt ───────────────────────────────────────

const CV_SYSTEM_PROMPT = `You are an expert CV/resume parser. Extract comprehensive structured candidate information from the provided CV text.

**Contact & Identity:**
- fullName: The candidate's full name
- email: Email address
- phone: Phone number, or null if not found
- location: City/country or timezone, or null if not found
- linkedinUrl: LinkedIn profile URL, or null if not found
- githubUrl: GitHub profile URL, or null if not found
- portfolioUrl: Personal website or portfolio URL, or null if not found

**Professional Summary:**
- headline: A short professional headline, e.g. "Senior Backend Engineer with 8+ years of experience"
- summary: A 2-4 sentence professional summary capturing the candidate's key strengths, domain expertise, and career focus. Write this from the CV content even if no explicit summary exists.
- experienceYears: Total years of professional experience (calculate from earliest job start date to now)
- skills: All technical and professional skills mentioned (be thorough — include programming languages, frameworks, tools, databases, cloud platforms, methodologies, soft skills)
- languages: Human languages spoken, e.g. ["English (Native)", "Spanish (Fluent)"]. Empty array if not mentioned.

**Work Experience (ordered most recent first):**
- company: Company name
- title: Job title
- startDate: Start date, e.g. "Jan 2020" or "2020"
- endDate: End date, or null if current position
- location: City/country or "Remote"
- description: 1-2 sentence role summary
- highlights: Key achievements, responsibilities, and measurable outcomes (3-5 bullet points)

**Education (ordered most recent first):**
- institution: University or school name
- degree: e.g. "Bachelor of Science", "Master of Engineering"
- field: e.g. "Computer Science", "Electrical Engineering"
- startDate: Start year
- endDate: Graduation year
- gpa: GPA if mentioned
- honors: Honors, distinctions, or relevant coursework

**Certifications:**
- name: Certification name, e.g. "AWS Solutions Architect"
- issuer: Issuing body, e.g. "Amazon Web Services"
- date: Date obtained
- expiryDate: Expiry date if applicable
- credentialId: Credential ID if provided

**Projects:**
- name: Project name
- description: What it does in 1-2 sentences
- technologies: Tech stack used
- url: Project or repo URL

Be thorough and precise. Extract everything available. For fields not found in the CV, use null or empty arrays. Do NOT invent information.`;

// ─── Parse CV → Candidate Profile ───────────────────────────

export async function parseCvToCandidate(cvText: string): Promise<ParsedCandidate> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: CV_SYSTEM_PROMPT },
      { role: 'user', content: cvText },
    ],
    response_format: zodResponseFormat(ParsedCandidateSchema, 'parsed_candidate'),
    temperature: 0.1,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');

  const raw = JSON.parse(content);
  const parsed = ParsedCandidateSchema.parse(raw);

  return {
    ...parsed,
    resumeText: cvText,
  };
}

// ─── JD Structured Output Schemas ───────────────────────────

const RubricCriterionSchema = z.object({
  name: z.string(),
  description: z.string(),
  maxScore: z.number(),
  weight: z.number(),
  order: z.number(),
});

const ParsedScenarioSchema = z.object({
  title: z.string(),
  description: z.string(),
  position: z.string(),
  level: z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL']),
  domain: z.string(),
  topics: z.array(z.string()),
  questionCount: z.number(),
  durationMinutes: z.number(),
  rubric: z.object({
    title: z.string(),
    criteria: z.array(RubricCriterionSchema),
  }),
});

// ─── JD TypeScript Type (inferred from Zod) ─────────────────

export type ParsedScenario = z.infer<typeof ParsedScenarioSchema>;

// ─── JD System Prompt ───────────────────────────────────────

const JD_SYSTEM_PROMPT = `You are an expert at analyzing job descriptions and creating structured interview scenarios.

From the provided job description, extract and generate:

1. **Scenario** fields:
   - title: A descriptive interview title, e.g. "Backend Engineer Technical Interview"
   - description: A paragraph describing what this interview will assess
   - position: The job title, e.g. "Backend Engineer"
   - level: One of: INTERN, JUNIOR, MID, SENIOR, STAFF, PRINCIPAL — infer from the JD
   - domain: The engineering domain, e.g. "Software Engineering", "Data Engineering", "DevOps"
   - topics: Key technical topics to cover in the interview (5-8 topics)
   - questionCount: Recommended number of questions (5-15 based on complexity)
   - durationMinutes: Recommended interview duration in minutes (15-60)

2. **Rubric** with evaluation criteria:
   - rubric.title: e.g. "Technical Assessment Rubric"
   - rubric.criteria: 4-6 evaluation criteria, each with:
     - name: e.g. "Technical Depth", "Problem Solving"
     - description: What this criterion evaluates
     - maxScore: Maximum score (always 5)
     - weight: Relative weight (all weights must sum to 1.0)
     - order: Display order starting at 0

Be specific to the role described in the JD.`;

// ─── Parse JD → Scenario + Rubric ──────────────────────────

export async function parseJdToScenario(jdText: string): Promise<ParsedScenario> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: JD_SYSTEM_PROMPT },
      { role: 'user', content: jdText },
    ],
    response_format: zodResponseFormat(ParsedScenarioSchema, 'parsed_scenario'),
    temperature: 0.2,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');

  const raw = JSON.parse(content);
  return ParsedScenarioSchema.parse(raw);
}
