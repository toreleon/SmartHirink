import OpenAI from 'openai';
import type { TtsAdapter } from '@smarthirink/core';
import { loadAgentEnv } from '../config.js';

/**
 * OpenAI TTS Adapter with streaming support.
 */
export class OpenAITtsAdapter implements TtsAdapter {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;
  private voice: string;

  constructor() {
    const env = loadAgentEnv();
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_TTS_MODEL;
    this.voice = env.OPENAI_TTS_VOICE;
  }

  async *synthesizeStream(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number },
  ): AsyncIterable<Buffer> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: (options?.voice ?? this.voice) as any,
      input: text,
      speed: options?.speed ?? 1.0,
      response_format: 'pcm', // raw 24kHz 16-bit mono LE PCM
    });

    // Stream the response body
    const reader = response.body as any;
    if (reader[Symbol.asyncIterator]) {
      for await (const chunk of reader) {
        yield Buffer.from(chunk);
      }
    } else {
      // Fallback: read as ArrayBuffer
      const buffer = Buffer.from(await response.arrayBuffer());
      // Yield in ~20ms chunks (24000 * 2 bytes/sec * 0.02 = 960 bytes)
      const chunkSize = 960;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        yield buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      }
    }
  }

  async synthesize(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number; format?: string },
  ): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: (options?.voice ?? this.voice) as any,
      input: text,
      speed: options?.speed ?? 1.0,
      response_format: (options?.format as any) ?? 'pcm',
    });

    return Buffer.from(await response.arrayBuffer());
  }
}
