export interface DocumentChunk {
  id: string;
  sourceType: 'question_bank' | 'job_description' | 'resume' | 'knowledge_base';
  sourceId: string;
  content: string;
  metadata: Record<string, string>;
  embedding?: number[];
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number; // cosine similarity
}

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
  separator?: string;
}

/**
 * Simple recursive text chunker.
 * Splits by paragraph → sentence → character fallback.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = { chunkSize: 512, overlap: 64 },
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];

  // Split by double newline (paragraphs)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= chunkSize) {
      buffer = buffer ? buffer + '\n\n' + para : para;
    } else {
      if (buffer) chunks.push(buffer.trim());
      // If a single paragraph exceeds chunkSize, split by sentences
      if (para.length > chunkSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        buffer = '';
        for (const sentence of sentences) {
          if ((buffer + ' ' + sentence).length <= chunkSize) {
            buffer = buffer ? buffer + ' ' + sentence : sentence;
          } else {
            if (buffer) chunks.push(buffer.trim());
            buffer = sentence;
          }
        }
      } else {
        buffer = para;
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  // Apply overlap
  if (overlap > 0 && chunks.length > 1) {
    const overlapped: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].slice(-overlap);
      overlapped.push(prevEnd + ' ' + chunks[i]);
    }
    return overlapped;
  }

  return chunks;
}
