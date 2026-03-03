# SmartHirink — AI Virtual Interview & Candidate Assessment

## Overview

SmartHirink is a full-stack TypeScript platform for conducting automated AI-powered voice interviews and generating structured candidate assessments. The AI interviewer ("Minh") conducts real-time conversations in Vietnamese (with English technical terms) via LiveKit WebRTC, then evaluates responses using an LLM-as-a-Judge pipeline.

## Architecture

```
┌────────────┐     WebRTC (LiveKit)     ┌──────────────┐
│  apps/web  │◄────────────────────────►│  LiveKit SFU  │
│  (Next.js) │                          └──────┬───────┘
└─────┬──────┘                                 │
      │ REST                          Audio + Data Channel
      ▼                                        │
┌────────────┐     Prisma + pgvector    ┌──────▼───────┐
│  apps/api  │◄────────────────────────►│   PostgreSQL  │
│  (Fastify) │                          └──────────────┘
└─────┬──────┘
      │ BullMQ                          ┌──────────────┐
      ▼                                 │    Redis      │
┌────────────┐     ┌──────────────┐     └──────────────┘
│ apps/agent │     │ apps/worker  │
│ (LiveKit   │     │ (BullMQ:     │
│  AI Agent) │     │  Evaluation  │
└────────────┘     │  + Report)   │
                   └──────────────┘
```

### Monorepo Structure

```
SmartHirink/
├── packages/
│   ├── core/         # Shared types, Zod schemas, adapter interfaces, prompts
│   └── rag/          # Chunker, pgvector store, context manager
├── apps/
│   ├── api/          # Fastify REST API + Prisma ORM
│   ├── agent/        # LiveKit AI interview agent (STT→LLM→TTS)
│   ├── worker/       # BullMQ workers (evaluation, PDF reports)
│   └── web/          # Next.js 14 frontend
├── infra/            # Docker Compose, Dockerfiles, LiveKit config
└── docs/             # This documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ / TypeScript |
| Frontend | Next.js 14, Tailwind CSS, Zustand, LiveKit Client SDK |
| Backend | Fastify, @fastify/jwt, @fastify/cors |
| Database | PostgreSQL 16 + pgvector (via Prisma ORM) |
| Queue | Redis + BullMQ |
| Real-time | LiveKit (WebRTC audio tracks + data channels) |
| STT | Deepgram (Nova-2, Vietnamese + code-switching) |
| LLM | OpenAI GPT-4o (streaming completions) |
| TTS | OpenAI TTS-1 (streaming PCM audio) |
| Embeddings | OpenAI text-embedding-3-small |
| PDF | pdf-lib |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- A `.env` file (copy from `.env.example`)

### Quick Start with Docker

```bash
cp .env.example .env
# Fill in API keys: OPENAI_API_KEY, DEEPGRAM_API_KEY, etc.

cd infra
docker compose up -d
```

This starts: PostgreSQL (pgvector), Redis, LiveKit server, API, Agent, Worker, Web.

### Local Development

```bash
npm install                        # Install all workspace deps
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma

# Terminal 1: API
npm run dev --workspace=apps/api

# Terminal 2: Agent
npm run dev --workspace=apps/agent

# Terminal 3: Worker
npm run dev --workspace=apps/worker

# Terminal 4: Web
npm run dev --workspace=apps/web
```

## Core Concepts

### Interview Lifecycle

1. **CREATED** — Recruiter creates interview session (scenario + rubric + candidate)
2. **WAITING** — Recruiter starts session → LiveKit room is provisioned
3. **INTRO** — Candidate joins room → Agent sends introduction
4. **QUESTIONING** — Multi-turn conversation following scenario topics
5. **WRAP_UP** — Agent asks if candidate has questions
6. **COMPLETED** — Session ends → evaluation job enqueued
7. **EVALUATING** → ScoreCard created → report job enqueued
8. **REPORTED** — PDF report ready for download

### Real-time Pipeline (per turn)

```
Candidate Mic → LiveKit Audio Track → Agent
  → STT (Deepgram streaming) → Final Transcript
  → LLM (GPT-4o streaming) → Sentence boundary split
  → TTS (OpenAI streaming) → PCM audio → LiveKit Audio Track → Candidate Speaker
  → Data Channel messages (partial_transcript, final_transcript, ai_text, state)
```

### Evaluation Pipeline

- BullMQ `evaluation` queue processes completed sessions
- LLM-as-a-Judge with structured JSON output
- Rubric-based scoring with evidence + reasoning per criterion
- Overall score, recommendation (STRONG_YES / YES / MAYBE / NO / STRONG_NO)
- Strengths & weaknesses identification

### Adapter Pattern

All AI providers are abstracted behind interfaces (`SttAdapter`, `LlmAdapter`, `TtsAdapter`, `EmbeddingAdapter`, `EvaluatorAdapter`). Swap providers by implementing the interface — no business logic changes needed.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, get JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| GET/POST | `/api/candidates` | JWT | List/create candidate profiles |
| GET/PUT | `/api/candidates/:id` | JWT | Get/update profile |
| GET/POST | `/api/scenarios` | JWT | List/create scenarios |
| GET/PUT/DEL | `/api/scenarios/:id` | JWT | CRUD scenario |
| POST | `/api/scenarios/:id/rubrics` | JWT (RECRUITER+) | Create rubric |
| GET/POST | `/api/interviews` | JWT | List/create sessions |
| GET | `/api/interviews/:id` | JWT | Get session detail |
| POST | `/api/interviews/:id/start` | JWT (RECRUITER+) | Start session |
| POST | `/api/interviews/:id/finish` | JWT | Finish session |
| GET | `/api/interviews/:id/transcript` | JWT | Get transcript |
| GET | `/api/interviews/:id/scorecard` | JWT | Get evaluation |
| GET | `/api/interviews/:id/report` | JWT | Get PDF report |
| POST | `/api/interviews/token` | JWT | Get LiveKit token |
| POST | `/api/webhooks/livekit` | — | LiveKit webhook |
| GET/POST | `/api/model-config` | JWT (ADMIN) | Manage model configs |

## Data Channel Messages

### Agent → Client

| Type | Payload |
|------|---------|
| `partial_transcript` | `{ text, isFinal: false }` |
| `final_transcript` | `{ text, isFinal: true }` |
| `ai_text` | `{ text, isFinal }` |
| `state` | `{ phase, currentTopic?, turnIndex }` |
| `error` | `{ code, message }` |
| `session_complete` | `{ sessionId, summary }` |

### Client → Agent

| Type | Payload |
|------|---------|
| `client_event` | `{ action: "end_interview" \| "skip_question" \| "repeat" }` |
| `candidate_metadata_update` | `{ notes? }` |

## Roles & Permissions

| Action | ADMIN | RECRUITER | CANDIDATE |
|--------|:-----:|:---------:|:---------:|
| Manage users | ✅ | ❌ | ❌ |
| Create scenarios/rubrics | ✅ | ✅ | ❌ |
| Create interviews | ✅ | ✅ | ❌ |
| Start interview | ✅ | ✅ | ❌ |
| Join interview | ✅ | ✅ | ✅ (own) |
| View results | ✅ | ✅ | ✅ (own) |
| Model config | ✅ | ❌ | ❌ |

## Ethics & Transparency

- AI interviewer explicitly identifies itself as AI at the start
- All sessions are recorded and transcribed — candidates are informed
- Evaluation results are advisory only — not a substitute for human judgment
- Every scorecard includes evidence + reasoning for auditability
- PDF reports contain an AI-generated disclaimer
- Audit logs track all critical actions

## Environment Variables

See `.env.example` for the complete list. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — JWT signing secret
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` — LiveKit credentials
- `OPENAI_API_KEY` — For LLM, TTS, embeddings
- `DEEPGRAM_API_KEY` — For STT
- `STT_PROVIDER`, `LLM_PROVIDER`, `TTS_PROVIDER` — Provider selection
