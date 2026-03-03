import { Worker, Queue, type Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import OpenAI from 'openai';
import pino from 'pino';
import {
  buildEvaluatorPrompt,
  EvaluationResultSchema,
  type EvaluatorPromptContext,
} from '@smarthirink/core';

const logger = pino({ name: 'evaluation-worker' });
const prisma = new PrismaClient();

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function processEvaluation(job: Job<{ sessionId: string }>): Promise<void> {
  const { sessionId } = job.data;
  logger.info({ sessionId }, 'Starting evaluation');

  // Load session data
  const session = await prisma.interviewSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      scenario: true,
      candidate: true,
      rubric: { include: { criteria: true } },
      turns: { orderBy: { index: 'asc' } },
    },
  });

  if (session.turns.length === 0) {
    logger.warn({ sessionId }, 'No turns to evaluate');
    return;
  }

  // Build evaluator prompt
  const promptCtx: EvaluatorPromptContext = {
    position: session.scenario.position,
    level: session.scenario.level,
    candidateName: session.candidate.fullName,
    rubricCriteria: session.rubric.criteria.map((c) => ({
      name: c.name,
      description: c.description,
      maxScore: c.maxScore,
      weight: c.weight,
    })),
    transcript: session.turns.map((t) => ({
      role: t.speakerRole as 'AI' | 'CANDIDATE',
      text: t.transcript,
    })),
    jobDescription: session.scenario.description,
  };

  const prompt = buildEvaluatorPrompt(promptCtx);

  // Try evaluation with retry on parse failure
  let evaluation;
  let lastError: Error | null = null;

  for (const temperature of [0.2, 0.1, 0.0]) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty evaluation response');
      }

      // Safe JSON parse with try-catch
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        throw new Error(`JSON parse failed: ${(parseErr as Error).message}`);
      }

      // Validate with Zod schema
      evaluation = EvaluationResultSchema.parse(parsed);
      lastError = null;
      break;
    } catch (err) {
      lastError = err as Error;
      logger.warn(
        { err, temperature, sessionId },
        'Evaluation attempt failed, retrying with lower temperature',
      );
    }
  }

  if (!evaluation || lastError) {
    throw lastError ?? new Error('Evaluation failed after all retries');
  }

  // Save score card with validated data
  const scoreCard = await prisma.scoreCard.create({
    data: {
      sessionId,
      overallScore: evaluation.overallScore,
      maxPossibleScore: evaluation.maxPossibleScore,
      criterionScores: evaluation.criterionScores,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      recommendation: evaluation.recommendation,
      evaluatedAt: new Date(),
    },
  });

  logger.info(
    { sessionId, scoreCardId: scoreCard.id, score: evaluation.overallScore },
    'Evaluation complete',
  );

  // Enqueue report generation
  const reportQueue = new Queue('report', { connection: redis as any });
  await reportQueue.add('generate', { sessionId, scoreCardId: scoreCard.id });
}

// Worker for turn persistence (from agent)
async function processTurnPersist(
  job: Job<{
    sessionId: string;
    index: number;
    role: string;
    text: string;
    latency: { sttMs?: number; llmTtftMs?: number; ttsFirstAudioMs?: number; e2eMs?: number };
  }>,
): Promise<void> {
  const { sessionId, index, role, text, latency } = job.data;

  await prisma.turn.upsert({
    where: { sessionId_index: { sessionId, index } },
    create: {
      sessionId,
      index,
      speakerRole: role,
      transcript: text,
      sttLatencyMs: latency.sttMs,
      llmTtftMs: latency.llmTtftMs,
      ttsFirstAudioMs: latency.ttsFirstAudioMs,
      e2eLatencyMs: latency.e2eMs,
      startedAt: new Date(),
    },
    update: {
      transcript: text,
      sttLatencyMs: latency.sttMs,
      llmTtftMs: latency.llmTtftMs,
      ttsFirstAudioMs: latency.ttsFirstAudioMs,
      e2eLatencyMs: latency.e2eMs,
      endedAt: new Date(),
    },
  });
}

export function startEvaluationWorker(): Worker {
  const worker = new Worker('evaluation', processEvaluation, {
    connection: redis as any,
    concurrency: 3,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Evaluation job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Evaluation job failed');
  });

  return worker;
}

export function startTurnPersistWorker(): Worker {
  const worker = new Worker('turn-persist', processTurnPersist, {
    connection: redis as any,
    concurrency: 10,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Turn persist job failed');
  });

  return worker;
}
