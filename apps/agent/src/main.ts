import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { loadAgentEnv } from './config.js';
import { InterviewAgent, type SessionInfo } from './interview-agent.js';
import { DeepgramSttAdapter } from './adapters/deepgram-stt.js';
import { OpenAILlmAdapter } from './adapters/openai-llm.js';
import { OpenAITtsAdapter } from './adapters/openai-tts.js';
import { GeminiTtsAdapter } from './adapters/gemini-tts.js';
import { OpenAIEmbeddingAdapter } from './adapters/openai-embedding.js';
import type { TtsAdapter } from '@smarthirink/core';
import { VectorStore, ContextManager } from '@smarthirink/rag';

const logger = pino({ name: 'agent-main' });
const env = loadAgentEnv();
const prisma = new PrismaClient();
const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Queues for async work
const evaluationQueue = new Queue('evaluation', { connection: redis as any });
const turnPersistQueue = new Queue('turn-persist', { connection: redis as any });

// Track active agents
const activeAgents = new Map<string, InterviewAgent>();

// RAG components (initialized in main())
let contextManager: ContextManager | undefined;

// Exponential backoff state
let consecutiveErrors = 0;
let pollInterval = 3000;
const MAX_POLL_INTERVAL = 60000;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Agent dispatcher: polls for WAITING sessions and creates agents.
 */
async function pollForSessions(): Promise<void> {
  try {
    const sessions = await prisma.interviewSession.findMany({
      where: { phase: 'WAITING' },
      include: {
        scenario: true,
        candidate: true,
        rubric: { include: { criteria: true } },
      },
    });

    // Reset backoff on success
    consecutiveErrors = 0;
    pollInterval = 3000;

    for (const session of sessions) {
      if (activeAgents.has(session.id)) continue;

      logger.info({ sessionId: session.id, room: session.livekitRoom }, 'Dispatching agent');

      const sessionInfo: SessionInfo = {
        sessionId: session.id,
        roomName: session.livekitRoom,
        candidateId: session.candidateId,
        candidateName: session.candidate.fullName,
        candidateSummary: [
          `Skills: ${session.candidate.skills.join(', ')}`,
          `Experience: ${session.candidate.experienceYears} years`,
          session.candidate.resumeText ? `Resume: ${session.candidate.resumeText.slice(0, 500)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        position: session.scenario.position,
        level: session.scenario.level,
        domain: session.scenario.domain,
        topics: session.scenario.topics,
        questionCount: session.scenario.questionCount,
        jobDescription: session.scenario.description,
      };

      const tts: TtsAdapter = env.TTS_PROVIDER === 'gemini'
        ? new GeminiTtsAdapter()
        : new OpenAITtsAdapter();

      const agent = new InterviewAgent(
        {
          stt: new DeepgramSttAdapter(),
          llm: new OpenAILlmAdapter(),
          tts,
          contextManager,
        },
        sessionInfo,
      );

      // Persist turns asynchronously
      agent.onTurnComplete = (turn) => {
        turnPersistQueue.add('persist-turn', {
          sessionId: session.id,
          ...turn,
        });
      };

      agent.onPhaseChange = async (phase) => {
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: { phase },
        });
      };

      agent.onSessionComplete = async () => {
        activeAgents.delete(session.id);
        await evaluationQueue.add('evaluate', { sessionId: session.id });
        logger.info({ sessionId: session.id }, 'Session complete, evaluation enqueued');
      };

      activeAgents.set(session.id, agent);

      agent.connect(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET).catch((err) => {
        logger.error({ err, sessionId: session.id }, 'Failed to connect agent');
        activeAgents.delete(session.id);
      });
    }
  } catch (err) {
    // Exponential backoff with jitter on consecutive errors
    consecutiveErrors++;
    const jitter = Math.random() * 1000;
    pollInterval = Math.min(pollInterval * 2, MAX_POLL_INTERVAL) + jitter;
    logger.error(
      { err, consecutiveErrors, nextPollMs: Math.round(pollInterval) },
      'Poll error, backing off',
    );
  }

  // Schedule next poll
  pollTimer = setTimeout(pollForSessions, pollInterval);
}

async function main(): Promise<void> {
  logger.info('Agent worker starting...');
  logger.info({
    stt: env.STT_PROVIDER,
    llm: env.LLM_PROVIDER,
    tts: env.TTS_PROVIDER,
  }, 'Configured providers');

  // Initialize RAG (VectorStore + ContextManager)
  try {
    const embedding = new OpenAIEmbeddingAdapter();
    const vectorStore = new VectorStore(
      { connectionString: env.DATABASE_URL },
      { dimensions: embedding.dimensions },
    );
    await vectorStore.initialize();
    contextManager = new ContextManager({ embedding, vectorStore });
    logger.info('RAG pipeline initialized (VectorStore + ContextManager)');
  } catch (err) {
    logger.warn({ err }, 'RAG initialization failed — running without context retrieval');
  }

  // Start polling
  await pollForSessions();

  logger.info('Agent worker running. Polling for sessions...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    if (pollTimer) clearTimeout(pollTimer);
    for (const [id, agent] of activeAgents) {
      logger.info({ sessionId: id }, 'Disconnecting agent');
      await agent.disconnect();
    }
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Agent worker crashed');
  process.exit(1);
});
