import { PDFParse } from 'pdf-parse';

/**
 * Extract text from an uploaded file buffer.
 * Supports PDF files (via pdf-parse) and plain text files.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const isPdf =
    mimetype === 'application/pdf' ||
    filename.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text?.trim();
    if (!text) {
      throw new Error('Could not extract text from PDF. The file may be image-based or empty.');
    }
    return text;
  }

  // Plain text fallback
  return buffer.toString('utf-8');
}
