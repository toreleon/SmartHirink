import { z } from 'zod';

const envSchema = z
  .object({
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
    OPENAI_BASE_URL: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o'),
    // TTS
    TTS_PROVIDER: z.enum(['openai', 'azure', 'elevenlabs', 'gemini', 'deepgram']).default('deepgram'),
    OPENAI_TTS_MODEL: z.string().default('tts-1'),
    OPENAI_TTS_VOICE: z.string().default('nova'),
    GOOGLE_API_KEY: z.string().optional(),
    GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),
    GEMINI_TTS_VOICE: z.string().default('Kore'),
    DEEPGRAM_TTS_MODEL: z.string().default('aura-2-thalia-en'),
    // Embedding
    EMBEDDING_PROVIDER: z.string().default('openai'),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
    // General
    LOG_LEVEL: z.string().default('info'),
    API_URL: z.string().default('http://localhost:4000'),
  })
  .superRefine((data, ctx) => {
    // Conditionally require API keys based on selected provider
    if ((data.STT_PROVIDER === 'deepgram' || data.TTS_PROVIDER === 'deepgram') && !data.DEEPGRAM_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DEEPGRAM_API_KEY is required when STT or TTS provider is deepgram',
        path: ['DEEPGRAM_API_KEY'],
      });
    }
    if (
      (data.LLM_PROVIDER === 'openai' || data.TTS_PROVIDER === 'openai' || data.EMBEDDING_PROVIDER === 'openai') &&
      !data.OPENAI_API_KEY
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required when LLM/TTS/Embedding provider is openai',
        path: ['OPENAI_API_KEY'],
      });
    }
    if (data.TTS_PROVIDER === 'gemini' && !data.GOOGLE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_API_KEY is required when TTS_PROVIDER=gemini',
        path: ['GOOGLE_API_KEY'],
      });
    }
  });

export type AgentEnv = z.infer<typeof envSchema>;

export function loadAgentEnv(): AgentEnv {
  return envSchema.parse(process.env);
}
