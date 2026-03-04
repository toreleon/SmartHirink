import type { TtsAdapter } from '@smarthirink/core';
import { loadAgentEnv } from '../config.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini TTS Adapter.
 * Uses the Gemini generateContent API with responseModalities=["AUDIO"].
 * Returns PCM 24kHz 16-bit mono audio (same format as OpenAI TTS PCM).
 */
export class GeminiTtsAdapter implements TtsAdapter {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;
  private voice: string;

  constructor() {
    const env = loadAgentEnv();
    this.apiKey = env.GOOGLE_API_KEY!;
    this.model = env.GEMINI_TTS_MODEL;
    this.voice = env.GEMINI_TTS_VOICE;
  }

  async *synthesizeStream(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number },
  ): AsyncIterable<Buffer> {
    // Gemini TTS doesn't support true streaming, so we fetch the full audio
    // and yield it in ~20ms chunks (960 bytes at 24kHz 16-bit mono)
    const audio = await this.synthesize(text, options);
    const chunkSize = 960;
    for (let i = 0; i < audio.length; i += chunkSize) {
      yield audio.subarray(i, Math.min(i + chunkSize, audio.length));
    }
  }

  async synthesize(
    text: string,
    options?: { voice?: string; speed?: number; sampleRate?: number; format?: string },
  ): Promise<Buffer> {
    const voice = options?.voice ?? this.voice;
    const url = `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    };

    const maxAttempts = 4;
    let response: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < maxAttempts) {
        // Parse retry delay from response if available, default to exponential backoff
        let waitMs = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        try {
          const errJson = await response.json() as any;
          const retryDelay = errJson?.error?.details?.find((d: any) =>
            d['@type']?.includes('RetryInfo'))?.retryDelay;
          if (retryDelay) {
            const seconds = parseInt(retryDelay);
            if (!isNaN(seconds)) waitMs = (seconds + 1) * 1000;
          }
        } catch { /* ignore parse error */ }
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      break;
    }

    if (!response!.ok) {
      const errorText = await response!.text();
      throw new Error(`Gemini TTS error (${response!.status}): ${errorText}`);
    }

    const json = await response!.json() as {
      candidates: Array<{
        content: {
          parts: Array<{
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    const audioData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error('Gemini TTS returned no audio data');
    }

    // Decode base64 to PCM buffer (24kHz, 16-bit mono, little-endian)
    return Buffer.from(audioData, 'base64');
  }
}
