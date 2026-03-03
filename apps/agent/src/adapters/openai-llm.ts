import OpenAI from 'openai';
import type { LlmAdapter, LlmMessage, LlmStreamToken } from '@smarthirink/core';
import { loadAgentEnv } from '../config.js';

/**
 * OpenAI LLM Adapter with streaming support.
 */
export class OpenAILlmAdapter implements LlmAdapter {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor() {
    const env = loadAgentEnv();
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL;
  }

  async *streamCompletion(
    messages: LlmMessage[],
    options?: { temperature?: number; maxTokens?: number; stopSequences?: string[] },
  ): AsyncIterable<LlmStreamToken> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 512,
      stop: options?.stopSequences,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield {
          text: delta.content,
          finishReason: chunk.choices[0]?.finish_reason as LlmStreamToken['finishReason'],
        };
      }
    }
  }

  async complete(
    messages: LlmMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: 'text' | 'json' },
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
      response_format:
        options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
