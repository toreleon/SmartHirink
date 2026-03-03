import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LIVEKIT_API_KEY: z.string(),
  LIVEKIT_API_SECRET: z.string(),
  LIVEKIT_URL: z.string(),
  // STT
  STT_PROVIDER: z.enum(['deepgram', 'google', 'azure']).default('deepgram'),
  DEEPGRAM_API_KEY: z.string().optional(),
  // LLM
  LLM_PROVIDER: z.enum(['openai', 'azure_openai', 'anthropic']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  // TTS
  TTS_PROVIDER: z.enum(['openai', 'azure', 'elevenlabs']).default('openai'),
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.string().default('nova'),
  // Embedding
  EMBEDDING_PROVIDER: z.string().default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  // General
  LOG_LEVEL: z.string().default('info'),
  API_URL: z.string().default('http://localhost:4000'),
});

export type AgentEnv = z.infer<typeof envSchema>;

export function loadAgentEnv(): AgentEnv {
  return envSchema.parse(process.env);
}
