/**
 * Cleans raw extracted text before chunking: collapses whitespace, drops
 * lines that repeat often enough to be boilerplate (nav/menu items pulled in
 * with the real content), and drops empty paragraphs. Paragraph breaks
 * (blank lines) are preserved — chunking splits on them.
 */
export function normalizeExtractedText(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    if (!line || line.length > 80) continue;
    lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
  }
  const boilerplate = new Set(
    [...lineCounts.entries()].filter(([, occurrences]) => occurrences >= 3).map(([line]) => line),
  );

  const cleanedLines = lines.map((line) => (boilerplate.has(line) ? "" : line));
  const collapsedBlank = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n");

  const paragraphs = collapsedBlank
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.join("\n\n");
}
