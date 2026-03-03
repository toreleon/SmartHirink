import type { EmbeddingAdapter } from '@smarthirink/core';
import { chunkText, type ChunkingOptions, type DocumentChunk } from './chunker.js';
import { VectorStore, } from './vector-store.js';
import { randomUUID } from 'crypto';

export interface ContextManagerOptions {
  embedding: EmbeddingAdapter;
  vectorStore: VectorStore;
  chunkingOptions?: ChunkingOptions;
}

/**
 * High-level context manager for RAG pipeline.
 * Ingests documents, embeds chunks, and retrieves relevant context.
 */
export class ContextManager {
  private embedding: EmbeddingAdapter;
  private vectorStore: VectorStore;
  private chunkingOptions: ChunkingOptions;

  constructor(options: ContextManagerOptions) {
    this.embedding = options.embedding;
    this.vectorStore = options.vectorStore;
    this.chunkingOptions = options.chunkingOptions ?? { chunkSize: 512, overlap: 64 };
  }

  /** Ingest a document: chunk → embed → store. */
  async ingest(
    sourceType: DocumentChunk['sourceType'],
    sourceId: string,
    text: string,
    metadata: Record<string, string> = {},
  ): Promise<number> {
    const chunks = chunkText(text, this.chunkingOptions);
    if (chunks.length === 0) return 0;

    const embeddings = await this.embedding.embed(chunks);

    const docChunks: DocumentChunk[] = chunks.map((content, i) => ({
      id: randomUUID(),
      sourceType,
      sourceId,
      content,
      metadata,
      embedding: embeddings[i],
    }));

    await this.vectorStore.upsertChunks(docChunks);
    return docChunks.length;
  }

  /** Retrieve context for a query. Returns concatenated relevant content. */
  async retrieve(
    query: string,
    options: {
      topK?: number;
      sourceType?: string;
      sourceId?: string;
      minScore?: number;
    } = {},
  ): Promise<string> {
    const queryEmb = await this.embedding.embedSingle(query);
    const results = await this.vectorStore.search(queryEmb, options);

    if (results.length === 0) return '';

    return results
      .map((r, i) => `[Ref ${i + 1} | score=${r.score.toFixed(3)}]\n${r.chunk.content}`)
      .join('\n\n');
  }

  /** Remove indexed data for a source. */
  async removeSource(sourceType: DocumentChunk['sourceType'], sourceId: string): Promise<void> {
    await this.vectorStore.deleteBySource(sourceType, sourceId);
  }
}
