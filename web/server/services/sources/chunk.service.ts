/**
 * Splits normalized text into ~800-token chunks with ~100 tokens of overlap,
 * on paragraph boundaries. There is no tokenizer dependency in this project,
 * so token counts are estimated at ~4 characters per token — the standard
 * rule of thumb for English text, close enough for chunk sizing.
 */

const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 800;
const OVERLAP_TOKENS = 100;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export type TextChunk = { content: string; tokenCount: number };

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** A paragraph longer than a whole chunk (long-form prose with no breaks, a
 * huge FAQ answer) is further split on sentence boundaries so chunking never
 * has to cut mid-sentence. */
function splitOversizedParagraph(paragraph: string): string[] {
  if (paragraph.length <= TARGET_CHUNK_CHARS) return [paragraph];

  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [paragraph];
  const pieces: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length > TARGET_CHUNK_CHARS) {
      pieces.push(buffer.trim());
      buffer = "";
    }
    buffer += sentence;
  }
  if (buffer.trim()) pieces.push(buffer.trim());
  return pieces;
}

export function chunkText(normalizedText: string): TextChunk[] {
  const paragraphs = splitIntoParagraphs(normalizedText).flatMap(splitOversizedParagraph);

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join("\n\n"));
  };

  for (const paragraph of paragraphs) {
    if (currentLength + paragraph.length > TARGET_CHUNK_CHARS && current.length > 0) {
      flush();

      // Carry trailing paragraphs from the finished chunk into the next one,
      // up to the overlap budget, so context isn't lost at the cut point.
      const overlap: string[] = [];
      let overlapLength = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const candidate = current[i];
        if (overlapLength + candidate.length > OVERLAP_CHARS) break;
        overlap.unshift(candidate);
        overlapLength += candidate.length;
      }
      current = overlap;
      currentLength = overlapLength;
    }

    current.push(paragraph);
    currentLength += paragraph.length;
  }
  flush();

  return chunks
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content) => ({ content, tokenCount: estimateTokenCount(content) }));
}
