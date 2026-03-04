import type { SttAdapter, SttStream, SttResult } from '@smarthirink/core';
import WebSocket from 'ws';
import { loadAgentEnv } from '../config.js';

/**
 * Deepgram STT Adapter — streaming via WebSocket.
 * Handles Vietnamese + English code-switching.
 */
export class DeepgramSttAdapter implements SttAdapter {
  readonly name = 'deepgram';
  private apiKey: string;

  constructor() {
    const env = loadAgentEnv();
    this.apiKey = env.DEEPGRAM_API_KEY ?? '';
  }

  createStream(options: {
    sampleRate: number;
    channels: number;
    languageHints?: string[];
  }): SttStream {
    return new DeepgramSttStream(this.apiKey, options);
  }
}

class DeepgramSttStream implements SttStream {
  private ws: WebSocket | null = null;
  private resultCb: ((result: SttResult) => void) | null = null;
  private errorCb: ((err: Error) => void) | null = null;
  private connected: Promise<void>;
  private isConnected = false;

  constructor(
    private apiKey: string,
    private options: { sampleRate: number; channels: number; languageHints?: string[] },
  ) {
    this.connected = this.connect();
    // Prevent unhandled rejection crash if connect fails before onError is set
    this.connected.catch(() => {});
  }

  private async connect(): Promise<void> {
    const language = this.options.languageHints?.[0] ?? 'en';
    const params = new URLSearchParams({
      model: 'nova-2',
      language,
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: '1500',
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: this.options.sampleRate.toString(),
      channels: this.options.channels.toString(),
    });

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        { headers: { Authorization: `Token ${this.apiKey}` } },
      );

      this.ws.on('open', () => {
        this.isConnected = true;
        resolve();
      });
      this.ws.on('error', (err) => {
        this.isConnected = false;
        this.errorCb?.(err);
        reject(err);
      });

      this.ws.on('unexpected-response', (_req, res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          const detail = `Deepgram WS ${res.statusCode}: ${body}`;
          const err = new Error(detail);
          this.errorCb?.(err);
          reject(err);
        });
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'Results') {
            const alt = msg.channel?.alternatives?.[0];
            if (!alt) return;

            const result: SttResult = msg.is_final
              ? {
                  text: alt.transcript,
                  isFinal: true,
                  confidence: alt.confidence,
                  language: msg.channel?.detected_language,
                  durationMs: (msg.duration ?? 0) * 1000,
                }
              : {
                  text: alt.transcript,
                  isFinal: false,
                  confidence: alt.confidence,
                  language: msg.channel?.detected_language,
                };

            if (alt.transcript) {
              this.resultCb?.(result);
            }
          }
        } catch (err) {
          this.errorCb?.(err as Error);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        if (code !== 1000) {
          const msg = reason?.toString() || `WebSocket closed with code ${code}`;
          this.errorCb?.(new Error(msg));
        }
      });
    });
  }

  pushAudio(frames: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frames);
    }
  }

  onResult(cb: (result: SttResult) => void): void {
    this.resultCb = cb;
  }

  onError(cb: (err: Error) => void): void {
    this.errorCb = cb;
  }

  async close(): Promise<void> {
    await this.connected;
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send close message per Deepgram protocol
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      this.ws.close();
    }
  }
}
