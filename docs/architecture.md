# Architecture Design Document

## 1. System Overview

SmartHirink implements a real-time AI interviewing system using a microservices-inspired monorepo architecture. All services are TypeScript-based and communicate through:

- **REST API** (Fastify) — CRUD operations, auth, session management
- **LiveKit** (WebRTC) — Real-time audio + data channels between candidate and AI agent
- **BullMQ** (Redis) — Async job processing for evaluation and report generation
- **PostgreSQL** — Persistent storage with pgvector for RAG embeddings

## 2. Component Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │                LiveKit SFU                   │
                        │   ┌─────────────────────────────────┐       │
                        │   │         Room: session_{id}       │       │
                        │   │                                  │       │
                        │   │  Audio Track ◄──► Audio Track    │       │
                        │   │  Data Channel ◄─► Data Channel   │       │
                        │   └─────────────────────────────────┘       │
                        └─────────┬─────────────────────┬─────────────┘
                                  │                     │
                           ┌──────▼──────┐       ┌──────▼──────┐
                           │  Candidate  │       │  AI Agent   │
                           │  (Browser)  │       │  (Node.js)  │
                           │             │       │             │
                           │ apps/web    │       │ apps/agent  │
                           └──────┬──────┘       └──────┬──────┘
                                  │                     │
                    REST API calls│                     │ Prisma / BullMQ
                                  │                     │
                           ┌──────▼─────────────────────▼──────┐
                           │            apps/api                │
                           │         (Fastify REST)             │
                           └──────┬──────────────────┬─────────┘
                                  │                  │
                         ┌────────▼────────┐  ┌──────▼──────┐
                         │   PostgreSQL    │  │    Redis     │
                         │  + pgvector     │  │  (BullMQ)    │
                         └────────────────┘  └──────┬──────┘
                                                     │
                                              ┌──────▼──────┐
                                              │ apps/worker  │
                                              │ (Evaluation  │
                                              │  + Reports)  │
                                              └─────────────┘
```

## 3. Sequence Diagram — One Interview Turn

```
Candidate        LiveKit         Agent          Deepgram       OpenAI (LLM)    OpenAI (TTS)
   │                │               │               │               │               │
   │──Audio Track──►│──Audio───────►│               │               │               │
   │                │               │──Push Audio──►│               │               │
   │                │               │               │               │               │
   │                │               │◄─Partial──────│               │               │
   │◄─DataCh: partial_transcript───│               │               │               │
   │                │               │               │               │               │
   │                │               │◄─Final────────│               │               │
   │◄─DataCh: final_transcript────│               │               │               │
   │                │               │               │               │               │
   │                │               │──Stream Req──────────────────►│               │
   │                │               │◄─Token stream─────────────────│               │
   │                │               │                               │               │
   │◄─DataCh: ai_text (partial)───│               │               │               │
   │                │               │                               │               │
   │                │               │──Sentence────────────────────────────────────►│
   │                │               │◄─PCM stream──────────────────────────────────│
   │                │◄─Audio Track──│               │               │               │
   │◄──Audio────────│               │               │               │               │
   │                │               │               │               │               │
   │◄─DataCh: ai_text (final)─────│               │               │               │
   │                │               │               │               │               │
```

## 4. Data Flow

### 4.1 Audio Path
- **Candidate → Agent**: Candidate publishes mic track → LiveKit routes to Agent room participant → Agent subscribes using `AudioStream` (from `@livekit/rtc-node`) to iterate raw PCM frames → feeds to `SttAdapter.pushAudio()`
- **Agent → Candidate**: TTS produces PCM chunks → Agent creates 20ms `AudioFrame` objects → publishes via `AudioSource.captureFrame()` through `LocalAudioTrack` → LiveKit routes to Candidate → Browser plays through `<audio>` element

### 4.2 Data Channel Path
- Agent sends structured JSON messages via LiveKit data channel (reliable mode)
- Client parses messages using discriminated union schemas from `@smarthirink/core`
- Message types: `partial_transcript`, `final_transcript`, `ai_text`, `state`, `error`, `session_complete`

### 4.3 Persistence Path
- Each completed turn is enqueued to BullMQ `evaluation` queue with job name `persist-turn`
- Worker upserts `Turn` records with latency metrics
- On session completion, full evaluation job is enqueued
- Evaluation produces `ScoreCard` → enqueues report → Worker generates PDF `Report`

## 5. Adapter Architecture

```
┌─────────────────────────────────────────────┐
│              packages/core/adapters          │
│                                              │
│  interface SttAdapter                        │
│    ├── DeepgramSttAdapter (default)          │
│    └── [future: WhisperSttAdapter]           │
│                                              │
│  interface LlmAdapter                        │
│    ├── OpenAILlmAdapter (default)            │
│    └── [future: AnthropicLlmAdapter]         │
│                                              │
│  interface TtsAdapter                        │
│    ├── OpenAITtsAdapter (default)            │
│    └── [future: ElevenLabsTtsAdapter]        │
│                                              │
│  interface EmbeddingAdapter                  │
│    ├── OpenAIEmbeddingAdapter (default)      │
│    └── [future: CohereEmbeddingAdapter]      │
│                                              │
│  interface EvaluatorAdapter                  │
│    ├── LLM-as-Judge (via LlmAdapter)         │
│    └── [future: custom ML model]             │
└─────────────────────────────────────────────┘
```

## 6. Security Model

- **Authentication**: JWT tokens issued on login, attached as `Authorization: Bearer <token>`
- **RBAC**: Three roles — ADMIN (full access), RECRUITER (manage interviews), CANDIDATE (own data only)
- **LiveKit Tokens**: Scoped per room with time-limited grants (role-based permissions for room join, publish, subscribe)
- **Audit Trail**: All critical operations logged to `AuditLog` table

## 7. Scalability Considerations

- **Agent**: Stateless per-session — scale horizontally by running multiple agent instances
- **Worker**: BullMQ supports multiple workers with automatic job distribution
- **API**: Stateless Fastify server — scale behind load balancer
- **LiveKit**: SFU natively supports distributed deployment
- **Database**: pgvector HNSW indexes for fast similarity search; connection pooling via Prisma
- **Redis**: Used for both BullMQ queues and potential caching layer

## 8. Vietnamese Language Support

- STT: Deepgram Nova-2 with `language: vi` + `detect_language: true` for code-switching
- LLM: System prompt enforces Vietnamese responses with English technical terms preserved
- TTS: OpenAI TTS with voice selection supporting Vietnamese pronunciation
- Evaluation: Prompts instruct evaluator to handle Vietnamese text and technical English transparently
