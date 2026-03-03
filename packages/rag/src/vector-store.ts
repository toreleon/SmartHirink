import { Pool, type PoolConfig } from 'pg';
import type { DocumentChunk, RetrievalResult } from './chunker.js';

/**
 * pgvector-backed vector store for RAG retrieval.
 * Uses a dedicated `document_chunks` table with a vector column.
 */
export class VectorStore {
  private pool: Pool;
  private dimensions: number;
  private tableName: string;

  constructor(
    poolConfig: PoolConfig,
    options: { dimensions?: number; tableName?: string } = {},
  ) {
    this.pool = new Pool(poolConfig);
    this.dimensions = options.dimensions ?? 1536;
    this.tableName = options.tableName ?? 'document_chunks';
  }

  /** Ensure pgvector extension and table exist. */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_type VARCHAR(64) NOT NULL,
          source_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(${this.dimensions}),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      // Create HNSW index for fast similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_embedding
        ON ${this.tableName}
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source
        ON ${this.tableName} (source_type, source_id)
      `);
    } finally {
      client.release();
    }
  }

  /** Insert document chunks with their embeddings. */
  async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const chunk of chunks) {
        const embStr = chunk.embedding
          ? `[${chunk.embedding.join(',')}]`
          : null;
        await client.query(
          `INSERT INTO ${this.tableName} (id, source_type, source_id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5, $6::vector)
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [chunk.id, chunk.sourceType, chunk.sourceId, chunk.content, chunk.metadata, embStr],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Similarity search returning top-k most similar chunks. */
  async search(
    queryEmbedding: number[],
    options: {
      topK?: number;
      sourceType?: string;
      sourceId?: string;
      minScore?: number;
    } = {},
  ): Promise<RetrievalResult[]> {
    const { topK = 5, sourceType, sourceId, minScore = 0.5 } = options;
    const embStr = `[${queryEmbedding.join(',')}]`;

    let whereClause = '';
    const params: (string | number)[] = [embStr, topK];
    let paramIdx = 3;

    const filters: string[] = [];
    if (sourceType) {
      filters.push(`source_type = $${paramIdx}`);
      params.push(sourceType);
      paramIdx++;
    }
    if (sourceId) {
      filters.push(`source_id = $${paramIdx}`);
      params.push(sourceId);
      paramIdx++;
    }

    if (filters.length > 0) {
      whereClause = 'WHERE ' + filters.join(' AND ');
    }

    const result = await this.pool.query(
      `SELECT id, source_type, source_id, content, metadata,
              1 - (embedding <=> $1::vector) AS score
       FROM ${this.tableName}
       ${whereClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      params,
    );

    return result.rows
      .filter((row: any) => row.score >= minScore)
      .map((row: any) => ({
        chunk: {
          id: row.id,
          sourceType: row.source_type,
          sourceId: row.source_id,
          content: row.content,
          metadata: row.metadata,
        },
        score: parseFloat(row.score),
      }));
  }

  /** Delete chunks by source. */
  async deleteBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
