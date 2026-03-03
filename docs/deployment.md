# Deployment Guide

## Prerequisites

- Docker 24+ & Docker Compose v2
- Domain with HTTPS (for production LiveKit WebRTC)
- API keys: OpenAI, Deepgram

## Development Deployment

```bash
# 1. Clone and setup
git clone <repo> && cd SmartHirink
cp .env.example .env
# Edit .env with your API keys

# 2. Start infrastructure
cd infra
docker compose up -d postgres redis livekit

# 3. Run migrations
cd ..
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma

# 4. Start services (each in separate terminal)
npm run dev --workspace=apps/api
npm run dev --workspace=apps/agent
npm run dev --workspace=apps/worker
npm run dev --workspace=apps/web
```

## Production Deployment (Docker)

```bash
cd infra

# Build and start everything
docker compose -f docker-compose.yml up -d --build

# Check status
docker compose ps
docker compose logs -f api agent worker
```

### Production Environment Variables

Update `.env` with production values:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db-host:5432/smarthirink
REDIS_URL=redis://redis-host:6379
JWT_SECRET=<strong-random-secret>

# LiveKit (use your hosted LiveKit Cloud or self-hosted)
LIVEKIT_URL=wss://your-livekit-domain.com
LIVEKIT_API_KEY=<your-key>
LIVEKIT_API_SECRET=<your-secret>

OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
```

### HTTPS & WebRTC

For production, LiveKit requires:
1. Valid SSL certificate (use Let's Encrypt)
2. TURN server if candidates are behind strict NATs
3. LiveKit Cloud handles this automatically

### Health Checks

- API: `GET /health` or `GET /api/health` → `{ status: "ok", timestamp: "..." }`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

### Port Configuration

| Service | Default Port |
|---------|-------------|
| API | 4000 |
| Web | 3000 |
| LiveKit | 7880 (WS), 7881 (RTC TCP), 7882 (RTC UDP) |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Scaling

```yaml
# Scale workers for parallel evaluation
docker compose up -d --scale worker=3

# Scale agents for concurrent interviews
docker compose up -d --scale agent=5
```

## Monitoring

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to enable OpenTelemetry traces.
All services log structured JSON to stdout — collect with your preferred log aggregator.
