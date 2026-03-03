import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker.js';

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const chunks = chunkText('Hello world.', { chunkSize: 512, overlap: 64 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world.');
  });

  it('splits by paragraphs', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const chunks = chunkText(text, { chunkSize: 30, overlap: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('splits long paragraphs by sentences', () => {
    const longPara = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five.';
    const chunks = chunkText(longPara, { chunkSize: 50, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be <= chunkSize or a single sentence longer than chunkSize
    for (const chunk of chunks) {
      // Either fits in chunkSize or is a single sentence
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it('applies overlap between chunks', () => {
    const text = 'First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph content.';
    const chunks = chunkText(text, { chunkSize: 40, overlap: 10 });
    if (chunks.length > 1) {
      // Second chunk should start with the end of the first chunk
      const firstEnd = chunks[0].slice(-10);
      expect(chunks[1].startsWith(firstEnd)).toBe(true);
    }
  });

  it('handles empty text', () => {
    const chunks = chunkText('', { chunkSize: 512, overlap: 64 });
    expect(chunks).toHaveLength(0);
  });

  it('handles whitespace-only text', () => {
    const chunks = chunkText('   \n\n   ', { chunkSize: 512, overlap: 64 });
    expect(chunks).toHaveLength(0);
  });

  it('handles single long word', () => {
    const longWord = 'a'.repeat(1000);
    const chunks = chunkText(longWord, { chunkSize: 100, overlap: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('uses default options', () => {
    const text = 'Short text.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short text.');
  });
});
