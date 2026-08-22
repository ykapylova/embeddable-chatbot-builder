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

/**
 * Below this a chunk carries no retrievable meaning — a stray "See also", a
 * page number left by a PDF — but it still costs an embedding, a row, and a
 * slot in the five a question gets. Applied only when dropping it still leaves
 * something behind: a genuinely tiny source is better indexed than empty.
 */
const MIN_CHUNK_CHARS = 40;

/** Headings are short, unpunctuated and stand alone on their own line. */
const HEADING_MAX_CHARS = 80;

export type TextChunk = {
  content: string;
  tokenCount: number;
  /** The nearest heading above this chunk, so a chunk that starts mid-section still says what it is about. */
  heading: string | null;
};

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * A markdown heading is unambiguous. Everything else — PDFs and plain text —
 * has to be guessed at, and the guess is deliberately narrow: one short line,
 * no sentence-ending punctuation. A false positive only mislabels a chunk; a
 * loose rule would label every short paragraph.
 */
export function detectHeading(paragraph: string): string | null {
  if (paragraph.includes("\n")) return null;

  const markdown = paragraph.match(/^#{1,6}\s+(.*\S)\s*$/);
  if (markdown) return markdown[1];

  if (paragraph.length > HEADING_MAX_CHARS) return null;
  if (/[.!?,;:]$/.test(paragraph)) return null;
  if (!/[\p{L}\p{N}]/u.test(paragraph)) return null;
  return paragraph;
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

/** Case and whitespace differences do not make two chunks different content. */
function dedupeKey(content: string): string {
  return content.toLowerCase().replace(/\s+/g, " ").trim();
}

export function chunkText(normalizedText: string): TextChunk[] {
  const paragraphs = splitIntoParagraphs(normalizedText).flatMap(splitOversizedParagraph);

  const chunks: { content: string; heading: string | null }[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let lastHeading: string | null = null;
  let currentHeading: string | null = null;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({ content: current.join("\n\n"), heading: currentHeading });
  };

  for (const paragraph of paragraphs) {
    const heading = detectHeading(paragraph);
    if (heading) lastHeading = heading;

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
      // The new chunk begins under whatever heading was last seen, which is
      // the whole point: a chunk cut out of the middle of a section otherwise
      // arrives with no clue what it is about.
      currentHeading = lastHeading;
    }

    if (current.length === 0) currentHeading = lastHeading;
    current.push(paragraph);
    currentLength += paragraph.length;
  }
  flush();

  const built = chunks
    .map((chunk) => ({ ...chunk, content: chunk.content.trim() }))
    .filter((chunk) => chunk.content.length > 0);

  // Repeated boilerplate blocks are common in documentation and in FAQ
  // exports, and two identical chunks can occupy two of the five retrieval
  // slots with the same sentence. Exact match on normalized text catches what
  // actually occurs; cosine dedup is not worth it at this scale.
  const seen = new Set<string>();
  const unique = built.filter((chunk) => {
    const key = dedupeKey(chunk.content);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const substantial = unique.filter((chunk) => chunk.content.length >= MIN_CHUNK_CHARS);
  const kept = substantial.length > 0 ? substantial : unique;

  return kept.map((chunk) => ({
    content: chunk.content,
    tokenCount: estimateTokenCount(chunk.content),
    heading: chunk.heading,
  }));
}
