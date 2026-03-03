import OpenAI from 'openai';
import type { EmbeddingAdapter } from '@smarthirink/core';
import { loadAgentEnv } from '../config.js';

export class OpenAIEmbeddingAdapter implements EmbeddingAdapter {
  readonly name = 'openai';
  readonly dimensions: number;
  private client: OpenAI;
  private model: string;

  constructor() {
    const env = loadAgentEnv();
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      ...(env.OPENAI_BASE_URL && { baseURL: env.OPENAI_BASE_URL }),
    });
    this.model = env.EMBEDDING_MODEL;
    this.dimensions = this.model.includes('3-small') ? 1536 : 3072;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }
}
