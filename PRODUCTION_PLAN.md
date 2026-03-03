# SmartHirink — Production Readiness Plan

## Current State Summary

The platform is a **functional prototype**: Docker builds, services start, pages render,
and the basic data model is in place. However, it has **critical security gaps**,
**missing middleware**, **incomplete error handling**, and several features that are
wired but not connected.

---

## P0 — Security & Auth (Must fix before any deployment)

### 1. API Authorization (apps/api/src/routes/)

**Problem**: 10+ endpoints check authentication but not **authorization**.
Any logged-in user can view/modify any interview, candidate, scorecard, or transcript.

| Endpoint | Gap |
|----------|-----|
| `GET /interviews/:id` | Any user sees any session |
| `POST /interviews/:id/start` | Any user can start any session |
| `POST /interviews/:id/finish` | Any user can finish any session |
| `GET /interviews/:id/transcript` | Any user reads any transcript |
| `GET /interviews/:id/scorecard` | Any user reads any scorecard |
| `GET /interviews/:id/report` | Any user reads any report |
| `POST /interviews/token` | Any user requests LiveKit token for any role |
| `GET /candidates/:id` | Any user views any candidate profile |
| `GET /candidates` | Any user lists all candidates |
| `PUT /scenarios/:id` | Any recruiter edits any scenario |

**Fix**: Create a shared `authorize()` helper:
- CANDIDATE: can only access own sessions (match `candidateId` → `candidateProfile.userId`)
- RECRUITER: can only access sessions they created (`recruiterId === user.id`)
- ADMIN: full access
- LiveKit token: validate `body.role` matches user's actual role & session membership

### 2. LiveKit Webhook Authentication (apps/api/src/routes/interviews.ts:212)

**Problem**: `POST /webhooks/livekit` is publicly accessible with no signature verification.
Anyone can forge fake audit events.

**Fix**: Verify LiveKit webhook signature (HMAC-SHA256) using `livekit-server-sdk` `WebhookReceiver`.

### 3. Model Config Input Validation (apps/api/src/routes/model-config.ts)

**Problem**: `POST /model-configs` and `PUT /model-configs/:id` accept `body as any` with
zero schema validation — mass assignment vulnerability.

**Fix**: Create `ModelConfigCreateSchema` in packages/core and apply it.

### 4. Rate Limiting

**Problem**: Zero rate limiting across all endpoints. Auth endpoints are brute-forceable.

**Fix**: Add `@fastify/rate-limit`:
- `/auth/login`: 5 attempts per minute per IP
- `/auth/register`: 3 per minute per IP
- All other routes: 100 per minute per user
- `/webhooks/*`: 30 per minute per IP

### 5. Security Headers

**Problem**: No HTTP security headers (no helmet, no CSP, no HSTS).

**Fix**: Add `@fastify/helmet` with sensible defaults.

### 6. Request Size Limit

**Problem**: No body size limit configured. Could accept multi-GB payloads.

**Fix**: Set Fastify `bodyLimit: 1_048_576` (1 MB).

---

## P1 — Web Frontend Auth & Guards (Broken user experience)

### 7. Next.js Auth Middleware (apps/web/)

**Problem**: 7 of 10 pages have **no auth guard**. Anyone can visit `/interviews`,
`/scenarios`, `/dashboard` without logging in. API calls fail silently with 401s
and pages render blank/broken.

**Fix**: Create `apps/web/src/middleware.ts` using Next.js middleware to redirect
unauthenticated users to `/login` for all routes except `/`, `/login`, `/register`.

### 8. Token Handling (apps/web/src/lib/store.ts, api.ts)

**Problem**: JWT stored in `localStorage` — vulnerable to XSS. No expiration check,
no refresh token flow, no auto-logout.

**Fix**:
- Move token to `httpOnly` cookie set by API (requires API change to set cookie on login)
- Add token expiration check on each API call
- Add 401 interceptor that redirects to `/login`
- Or at minimum: add `api.ts` response interceptor that catches 401 and clears auth state

### 9. Error Handling & Loading States (all pages)

**Problem**: Pages use `alert()` for errors, `console.error()` for failures, and show
bare "Đang tải..." text for loading. No error boundaries.

**Fix**:
- Replace `alert()` with toast notifications
- Add React Error Boundary wrapper
- Add skeleton loading components
- Show user-friendly error messages on API failures

---

## P2 — Agent Audio Pipeline Robustness (Interview reliability)

### 10. STT Error Recovery (apps/agent/src/interview-agent.ts:263)

**Problem**: If Deepgram WebSocket dies mid-interview, `recoverable: true` is sent
but no recovery happens. Interview hangs.

**Fix**: Implement STT stream reconnection logic — on error, create new stream
and resume pushing audio frames.

### 11. Dropped Utterances (interview-agent.ts:298-301)

**Problem**: If user speaks while AI is responding, utterance is silently dropped
(`return` with no queue).

**Fix**: Add an utterance queue (max 3) that processes after current AI response completes.

### 12. LLM Error Mid-Stream (interview-agent.ts:418-429)

**Problem**: If LLM fails mid-stream, partial AI text is already sent to client,
turn counter still increments, and `recoverable: true` is sent but nothing recovers.

**Fix**: Track whether turn was fully completed. On error, don't increment question
index. Send explicit "retry" state to client.

### 13. API Key Validation at Startup

**Problem**: Deepgram/OpenAI API keys marked optional in config schema. If missing,
service starts but crashes on first interview.

**Fix**: Make keys required when their provider is selected:
`DEEPGRAM_API_KEY` required when `STT_PROVIDER=deepgram`, etc.

---

## P3 — Worker Data Integrity (Evaluation correctness)

### 14. Unsafe JSON.parse in Evaluation Worker (apps/worker/src/evaluation-worker.ts:75)

**Problem**: `JSON.parse(content)` on LLM response with no try-catch or schema validation.
Malformed JSON crashes the job permanently.

**Fix**: Wrap in try-catch, validate with Zod `EvaluationResultSchema`, retry with
different temperature on parse failure.

### 15. Unsafe Type Casts in Workers

**Problem**: `criterionScores` cast as `as any` in evaluation-worker.ts:83 and
`as Array<...>` in report-worker.ts:40. Silent data corruption possible.

**Fix**: Validate JSONB data with Zod schema before use.

### 16. Report File Cleanup (apps/worker/src/report-worker.ts:178-191)

**Problem**: If `prisma.report.create()` fails after file write, orphaned PDF stays on disk.

**Fix**: Wrap in try-catch — on DB failure, delete the PDF file.

---

## P4 — Missing Features (Feature completeness)

### 17. RAG Integration (Wired but not connected)

**Problem**: Full RAG pipeline exists (`packages/rag`: chunker → embedder → pgvector → retriever)
and `interview-agent.ts` uses it (lines 321-332), but `main.ts` never initializes
`ContextManager`. Feature is built but disabled.

**Fix**:
- Initialize VectorStore + ContextManager in agent `main.ts`
- Add question bank ingestion endpoint or CLI tool
- Note: `document_chunks` table is created by VectorStore.initialize(), not Prisma

### 18. Pagination Bounds (apps/api/src/routes/)

**Problem**: `page` and `limit` query params have no bounds. `limit=999999` or `page=-1`
produce undefined behavior.

**Fix**: Clamp values: `page = Math.max(1, page)`, `limit = Math.min(Math.max(1, limit), 100)`.

### 19. Missing API Endpoints

| Feature | Status |
|---------|--------|
| Password change | Not implemented |
| Password reset | Not implemented |
| Logout / token invalidation | Not implemented (JWT valid until expiry) |
| User profile update | Not implemented |
| Rubric edit/delete | Not implemented |
| Scenario search/filter | Not implemented |
| Interview search/filter | Not implemented |
| Audit log viewer (admin) | Not implemented |
| Report download (serve PDF) | Route exists but file serving not configured |

### 20. Missing Web Pages

| Page | Status |
|------|--------|
| User profile/settings | Missing |
| Password reset flow | Missing |
| Admin panel | Missing |
| Candidate profile page | Missing (only dropdown in new interview) |
| 404 page | Missing |
| Error page | Missing |

### 21. JWT Refresh Token

**Problem**: JWT expires in 7 days with no refresh mechanism. Users must re-login.

**Fix**: Add refresh token flow — store refresh token in httpOnly cookie,
add `POST /auth/refresh` endpoint.

---

## P5 — Operational Readiness (Production ops)

### 22. Agent Polling Backoff (apps/agent/src/main.ts:117)

**Problem**: Fixed 3-second polling interval. If DB is down, hammers it every 3s.

**Fix**: Exponential backoff with jitter on consecutive errors.

### 23. Worker Startup Health Checks

**Problem**: Workers start without verifying Redis/PostgreSQL connectivity.

**Fix**: Add `redis.ping()` and `prisma.$queryRaw` checks before starting job processing.

### 24. Graceful Shutdown

**Problem**: API server has no graceful shutdown for in-flight requests.

**Fix**: Add SIGTERM handler that stops accepting new connections and drains existing ones.

### 25. Observability

| Item | Status |
|------|--------|
| Structured logging | Done (pino) |
| Request logging | Fastify auto-logs |
| Audit trail | Done (AuditLog table) |
| Metrics (Prometheus) | Not implemented |
| Distributed tracing (OpenTelemetry) | Env var exists, not wired |
| Health check dashboard | Not implemented |
| Alert rules | Not implemented |

---

## Implementation Priority

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **Phase 1** | P0 #1-6 (Security) | 2-3 days | Prevents unauthorized access |
| **Phase 2** | P1 #7-9 (Frontend auth) | 1-2 days | Usable frontend |
| **Phase 3** | P2 #10-13 (Agent robustness) | 1-2 days | Reliable interviews |
| **Phase 4** | P3 #14-16 (Worker safety) | 0.5 day | Correct evaluations |
| **Phase 5** | P4 #17-21 (Features) | 3-5 days | Feature complete |
| **Phase 6** | P5 #22-25 (Ops) | 1-2 days | Production ops |

**Total estimated: ~10-15 days of focused work**

---

## Architecture Diagram (Current)

```
Browser (Next.js)
  ↓ REST (JWT)
API Server (Fastify :4000)
  ├── PostgreSQL (Prisma ORM)
  ├── Redis (ioredis)
  └── LiveKit Server (:7880)
        ↕ WebRTC audio
Agent (Node.js)
  ├── Deepgram STT (WebSocket)
  ├── OpenAI GPT-4o (streaming)
  ├── OpenAI TTS (PCM streaming)
  └── [RAG — built but not wired]
Worker (BullMQ)
  ├── Evaluation (OpenAI → ScoreCard)
  └── Report (pdf-lib → PDF file)
```
