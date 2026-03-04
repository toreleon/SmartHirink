import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { loadAgentEnv } from './config.js';
import { InterviewVoiceAgent, type SessionInfo } from './interview-agent.js';
import { OpenAIEmbeddingAdapter } from './adapters/openai-embedding.js';
import { VectorStore, ContextManager } from '@smarthirink/rag';

const logger = pino({ name: 'agent-main' });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    logger.info('Prewarming agent worker...');

    const env = loadAgentEnv();

    // Shared resources for all jobs in this process
    const prisma = new PrismaClient();
    const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const evaluationQueue = new Queue('evaluation', { connection: redis as any });
    const turnPersistQueue = new Queue('turn-persist', { connection: redis as any });

    // Load Silero VAD model (CPU ONNX, ~2MB, loads once)
    const vad = await silero.VAD.load();

    // Initialize RAG pipeline
    let contextManager: ContextManager | undefined;
    try {
      const embedding = new OpenAIEmbeddingAdapter();
      const vectorStore = new VectorStore(
        { connectionString: env.DATABASE_URL },
        { dimensions: embedding.dimensions },
      );
      await vectorStore.initialize();
      contextManager = new ContextManager({ embedding, vectorStore });
      logger.info('RAG pipeline initialized');
    } catch (err) {
      logger.warn({ err }, 'RAG initialization failed — running without context retrieval');
    }

    proc.userData = { env, prisma, redis, evaluationQueue, turnPersistQueue, vad, contextManager };

    logger.info({
      stt: 'deepgram',
      llm: env.LLM_PROVIDER,
      tts: 'deepgram',
    }, 'Agent worker prewarmed');
  },

  entry: async (ctx: JobContext) => {
    const {
      env,
      prisma,
      evaluationQueue,
      turnPersistQueue,
      vad,
      contextManager,
    } = ctx.proc.userData as {
      env: ReturnType<typeof loadAgentEnv>;
      prisma: PrismaClient;
      evaluationQueue: Queue;
      turnPersistQueue: Queue;
      vad: silero.VAD;
      contextManager: ContextManager | undefined;
    };

    await ctx.connect();

    const roomName = ctx.room.name;
    logger.info({ roomName }, 'Agent dispatched to room');

    // Look up the interview session from DB by room name
    const dbSession = await prisma.interviewSession.findFirst({
      where: { livekitRoom: roomName },
      include: {
        scenario: true,
        candidate: true,
        rubric: { include: { criteria: true } },
      },
    });

    if (!dbSession) {
      logger.warn({ roomName }, 'No interview session found for room, shutting down');
      ctx.shutdown('no-session');
      return;
    }

    logger.info({
      sessionId: dbSession.id,
      candidate: dbSession.candidate.fullName,
      scenario: dbSession.scenario.title,
    }, 'Interview session found');

    const sessionInfo: SessionInfo = {
      sessionId: dbSession.id,
      roomName: dbSession.livekitRoom,
      candidateId: dbSession.candidateId,
      candidateName: dbSession.candidate.fullName,
      candidateSummary: [
        `Skills: ${dbSession.candidate.skills.join(', ')}`,
        `Experience: ${dbSession.candidate.experienceYears} years`,
        dbSession.candidate.resumeText ? `Resume: ${dbSession.candidate.resumeText.slice(0, 500)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      position: dbSession.scenario.position,
      level: dbSession.scenario.level,
      domain: dbSession.scenario.domain,
      topics: dbSession.scenario.topics,
      questionCount: dbSession.scenario.questionCount,
      jobDescription: dbSession.scenario.description,
      language: dbSession.scenario.language ?? 'en',
    };

    // Create the interview agent
    const agent = new InterviewVoiceAgent(sessionInfo, contextManager);

    // Wire up persistence callbacks
    agent.onTurnComplete = (turn) => {
      turnPersistQueue.add('persist-turn', {
        sessionId: dbSession.id,
        ...turn,
      });
    };

    agent.onPhaseChange = async (phase) => {
      try {
        await prisma.interviewSession.update({
          where: { id: dbSession.id },
          data: { phase },
        });
      } catch (err) {
        logger.error({ err, sessionId: dbSession.id }, 'Failed to update phase');
      }
    };

    agent.onSessionComplete = async () => {
      try {
        await evaluationQueue.add('evaluate', { sessionId: dbSession.id });
        logger.info({ sessionId: dbSession.id }, 'Session complete, evaluation enqueued');
      } catch (err) {
        logger.error({ err, sessionId: dbSession.id }, 'Failed to enqueue evaluation');
      }
    };

    // Configure the voice pipeline with streaming STT → LLM → TTS
    const lang = sessionInfo.language;

    const agentSession = new voice.AgentSession({
      stt: new deepgram.STT({
        model: 'nova-3',
        language: lang === 'vi' ? 'vi' : 'en',
        interimResults: true,
        smartFormat: true,
        punctuate: true,
      }),
      llm: new openai.LLM({
        model: env.OPENAI_MODEL,
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
        temperature: 0.7,
      }),
      tts: new deepgram.TTS({
        model: lang === 'vi' ? 'aura-2-thalia-en' : 'aura-2-thalia-en',
      }),
      vad,
      turnDetection: 'vad',
      voiceOptions: {
        allowInterruptions: true,
        minInterruptionDuration: 500,
        minEndpointingDelay: 500,
      },
    });

    // Start the fully streaming voice pipeline
    await agentSession.start({
      agent,
      room: ctx.room,
    });

    logger.info({
      sessionId: dbSession.id,
      roomName,
      pipeline: 'STT(deepgram/nova-3) → LLM(openai) → TTS(deepgram/aura-2)',
    }, 'Interview voice pipeline started');

    // Graceful cleanup when the job shuts down
    ctx.addShutdownCallback(async () => {
      logger.info({ sessionId: dbSession.id }, 'Shutting down interview agent');
      await agentSession.close();
    });
  },
});

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection (caught, not crashing)');
});

// Bootstrap the LiveKit agent worker
cli.runApp(new WorkerOptions({ agent: __filename }));
