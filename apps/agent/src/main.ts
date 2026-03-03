import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { loadAgentEnv } from './config.js';
import { InterviewAgent, type SessionInfo } from './interview-agent.js';
import { DeepgramSttAdapter } from './adapters/deepgram-stt.js';
import { OpenAILlmAdapter } from './adapters/openai-llm.js';
import { OpenAITtsAdapter } from './adapters/openai-tts.js';

const logger = pino({ name: 'agent-main' });
const env = loadAgentEnv();
const prisma = new PrismaClient();
const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Queues for async work
const evaluationQueue = new Queue('evaluation', { connection: redis as any });
const turnPersistQueue = new Queue('turn-persist', { connection: redis as any });

// Track active agents
const activeAgents = new Map<string, InterviewAgent>();

/**
 * Agent dispatcher: listens for new interview sessions that need an agent.
 * In production, this would be driven by:
 * - BullMQ job queue (session.start → dispatch agent)
 * - LiveKit webhook (room created → dispatch agent)
 * - Redis pub/sub
 *
 * For simplicity, we poll for WAITING sessions.
 */
async function pollForSessions(): Promise<void> {
  const sessions = await prisma.interviewSession.findMany({
    where: { phase: 'WAITING' },
    include: {
      scenario: true,
      candidate: true,
      rubric: { include: { criteria: true } },
    },
  });

  for (const session of sessions) {
    if (activeAgents.has(session.id)) continue;

    logger.info({ sessionId: session.id, room: session.livekitRoom }, 'Dispatching agent');

    const sessionInfo: SessionInfo = {
      sessionId: session.id,
      roomName: session.livekitRoom,
      candidateId: session.candidateId,
      candidateName: session.candidate.fullName,
      candidateSummary: [
        `Kỹ năng: ${session.candidate.skills.join(', ')}`,
        `Kinh nghiệm: ${session.candidate.experienceYears} năm`,
        session.candidate.resumeText ? `CV: ${session.candidate.resumeText.slice(0, 500)}` : '',
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

    const agent = new InterviewAgent(
      {
        stt: new DeepgramSttAdapter(),
        llm: new OpenAILlmAdapter(),
        tts: new OpenAITtsAdapter(),
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
      // Enqueue evaluation
      await evaluationQueue.add('evaluate', { sessionId: session.id });
      logger.info({ sessionId: session.id }, 'Session complete, evaluation enqueued');
    };

    activeAgents.set(session.id, agent);

    // Connect agent to room
    agent.connect(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET).catch((err) => {
      logger.error({ err, sessionId: session.id }, 'Failed to connect agent');
      activeAgents.delete(session.id);
    });
  }
}

async function main(): Promise<void> {
  logger.info('Agent worker starting...');
  logger.info({
    stt: env.STT_PROVIDER,
    llm: env.LLM_PROVIDER,
    tts: env.TTS_PROVIDER,
  }, 'Configured providers');

  // Poll every 3 seconds for new sessions
  setInterval(pollForSessions, 3000);

  // Initial poll
  await pollForSessions();

  logger.info('Agent worker running. Polling for sessions...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
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
