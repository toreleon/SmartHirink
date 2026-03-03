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
│   ├── core/         # Shared types, Zod schemas, adapter interfaces, prompts, data-channel helpers
│   └── rag/          # Chunker, pgvector store, context manager
├── apps/
│   ├── api/          # Fastify REST API + Prisma ORM (port 4000)
│   ├── agent/        # LiveKit AI interview agent (STT→LLM→TTS) using @livekit/rtc-node
│   ├── worker/       # BullMQ workers (evaluation, turn-persist, PDF reports)
│   └── web/          # Next.js 14 frontend (port 3000)
├── infra/            # Docker Compose, Dockerfiles, LiveKit config
└── docs/             # This documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ / TypeScript (ES2022, NodeNext) |
| Frontend | Next.js 14, Tailwind CSS, Zustand, LiveKit Client SDK |
| Backend | Fastify, @fastify/jwt, @fastify/cors |
| Database | PostgreSQL 16 + pgvector (via Prisma ORM) |
| Queue | Redis + BullMQ |
| Real-time | LiveKit (WebRTC audio tracks + data channels) |
| Agent SDK | @livekit/rtc-node (Node.js server-side WebRTC) |
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

# Start infra services only
cd infra && docker compose -f docker-compose.dev.yml up -d && cd ..

# Run migrations
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma

# Terminal 1: API (port 4000)
npm run dev --workspace=apps/api

# Terminal 2: Agent
npm run dev --workspace=apps/agent

# Terminal 3: Worker
npm run dev --workspace=apps/worker

# Terminal 4: Web (port 3000)
npm run dev --workspace=apps/web
```

## Core Concepts

### Interview Lifecycle

1. **CREATED** — Recruiter creates interview session (scenario + rubric + candidate)
2. **WAITING** — Recruiter starts session → LiveKit room is provisioned
3. **INTRO** — Candidate joins room → Agent sends introduction
4. **QUESTIONING** — Multi-turn conversation following scenario topics
5. **WRAP_UP** — Agent reaches question count → sends outro message
6. **COMPLETED** — Session ends → evaluation job enqueued via BullMQ

### Real-time Pipeline (per turn)

```
Candidate Mic → LiveKit Audio Track → Agent (AudioStream iterator)
  → STT (Deepgram streaming WebSocket) → Final Transcript
  → LLM (GPT-4o streaming) → Sentence boundary split
  → TTS (OpenAI streaming) → PCM frames → AudioSource.captureFrame() → LiveKit Audio Track
  → Data Channel messages (partial_transcript, final_transcript, ai_text, state)
```

### Evaluation Pipeline

- BullMQ `evaluation` queue processes completed sessions
- LLM-as-a-Judge with structured JSON output
- Rubric-based scoring with evidence + reasoning per criterion
- Overall score, recommendation (STRONG_YES / YES / MAYBE / NO / STRONG_NO)
- Strengths & weaknesses identification
- Automatic PDF report generation via `report` queue

### Adapter Pattern

All AI providers are abstracted behind interfaces (`SttAdapter`, `LlmAdapter`, `TtsAdapter`, `EmbeddingAdapter`, `EvaluatorAdapter`). Swap providers by implementing the interface — no business logic changes needed.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, get JWT |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/candidates/profile` | JWT | Create/update candidate profile |
| GET | `/api/candidates/profile` | JWT | Get own profile |
| GET | `/api/candidates/:id` | JWT | Get candidate by ID |
| GET | `/api/candidates` | JWT | List candidates |
| GET/POST | `/api/scenarios` | JWT | List/create scenarios |
| GET/PUT/DEL | `/api/scenarios/:id` | JWT | CRUD scenario |
| POST | `/api/rubrics` | JWT (RECRUITER+) | Create rubric |
| GET | `/api/rubrics/:id` | JWT | Get rubric |
| GET | `/api/scenarios/:id/rubrics` | JWT | List rubrics for scenario |
| GET/POST | `/api/interviews` | JWT | List/create sessions |
| GET | `/api/interviews/:id` | JWT | Get session detail |
| POST | `/api/interviews/:id/start` | JWT (RECRUITER+) | Start session |
| POST | `/api/interviews/:id/finish` | JWT | Finish session |
| GET | `/api/interviews/:id/transcript` | JWT | Get transcript |
| GET | `/api/interviews/:id/scorecard` | JWT | Get evaluation |
| GET | `/api/interviews/:id/report` | JWT | Get PDF report |
| POST | `/api/interviews/token` | JWT | Get LiveKit token |
| POST | `/api/webhooks/livekit` | — | LiveKit webhook |
| GET/POST/PUT | `/api/model-configs` | JWT (ADMIN) | Manage model configs |
| GET | `/health` | — | Health check |

## Data Channel Messages

### Agent → Client

| Type | Fields |
|------|--------|
| `partial_transcript` | `{ turnId, text, isFinal: false, t }` |
| `final_transcript` | `{ turnId, text, isFinal: true, t }` |
| `ai_text` | `{ turnId, text, t }` |
| `state` | `{ phase, speaking: { who }, vad, t }` |
| `error` | `{ code, message, recoverable, t }` |
| `session_complete` | `{ sessionId, t }` |

### Client → Agent

| Type | Fields |
|------|--------|
| `client_event` | `{ action: 'start' \| 'pause' \| 'stop' \| 'ping', t }` |
| `candidate_metadata_update` | `{ languageHint?, t }` |

All messages are validated using Zod discriminated union schemas from `@smarthirink/core`. Use `encodeAgentMessage()` / `decodeAgentMessage()` and `encodeClientMessage()` / `decodeClientMessage()` helpers from `@smarthirink/core/data-channel`.

## Roles & Permissions

| Action | ADMIN | RECRUITER | CANDIDATE |
|--------|:-----:|:---------:|:---------:|
| Manage users | yes | no | no |
| Create scenarios/rubrics | yes | yes | no |
| Create interviews | yes | yes | no |
| Start interview | yes | yes | no |
| Join interview | yes | yes | yes (own) |
| View results | yes | yes | yes (own) |
| Model config | yes | no | no |

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
- `PORT` — API server port (default: 4000)
- `APP_URL` — Frontend URL (default: http://localhost:3000)
