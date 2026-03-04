import type { TtsAdapter } from '@smarthirink/core';
import { loadAgentEnv } from '../config.js';

const DEEPGRAM_TTS_BASE = 'https://api.deepgram.com/v1/speak';

/**
 * Deepgram TTS Adapter (Aura).
 * Uses the Deepgram REST TTS API with linear16 encoding.
 * Returns PCM 24kHz 16-bit mono audio.
 */
export class DeepgramTtsAdapter implements TtsAdapter {
  readonly name = 'deepgram';
  private apiKey: string;
  private model: string;

  constructor() {
    const env = loadAgentEnv();
    this.apiKey = env.DEEPGRAM_API_KEY!;
    this.model = env.DEEPGRAM_TTS_MODEL;
  }

  async *synthesizeStream(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number },
  ): AsyncIterable<Buffer> {
    const audio = await this.synthesize(text, options);
    // Yield in ~20ms chunks (960 bytes at 24kHz 16-bit mono)
    const chunkSize = 960;
    for (let i = 0; i < audio.length; i += chunkSize) {
      yield audio.subarray(i, Math.min(i + chunkSize, audio.length));
    }
  }

  async synthesize(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number; format?: string },
  ): Promise<Buffer> {
    const model = options?.voice ?? this.model;
    const sampleRate = options?.sampleRate ?? 24000;

    const params = new URLSearchParams({
      model,
      encoding: 'linear16',
      sample_rate: sampleRate.toString(),
      container: 'none',
    });

    const url = `${DEEPGRAM_TTS_BASE}?${params.toString()}`;

    const maxAttempts = 4;
    let response: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (response.status === 429 && attempt < maxAttempts) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      break;
    }

    if (!response!.ok) {
      const errorText = await response!.text();
      throw new Error(`Deepgram TTS error (${response!.status}): ${errorText}`);
    }

    const arrayBuffer = await response!.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
