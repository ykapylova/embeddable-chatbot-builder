import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";

import type { SourceFileExtension } from "server/limits";

import { SourceContentError } from "./errors";

async function extractTextFromPdf(bytes: Buffer): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } catch (error) {
    // A file the parser cannot open at all — truncated, encrypted, or simply
    // not a PDF behind a .pdf name. Left unwrapped it surfaced as the generic
    // "Try again", which is advice that cannot work: the bytes will not change.
    console.error("[extractTextFromPdf]", error);
    throw new SourceContentError(
      "This PDF could not be opened — it may be corrupted or password-protected.",
      "UNSUPPORTED_CONTENT",
    );
  } finally {
    await parser.destroy();
  }
}

function extractPlainText(bytes: Buffer): string {
  return bytes.toString("utf-8");
}

export async function extractTextForFile(
  bytes: Buffer,
  extension: SourceFileExtension,
): Promise<string> {
  if (extension === "pdf") {
    const text = await extractTextFromPdf(bytes);
    if (!text.trim()) {
      throw new SourceContentError("This PDF has no extractable text — it may be a scan.", "EMPTY_SOURCE");
    }
    return text;
  }

  const text = extractPlainText(bytes);
  if (!text.trim()) {
    throw new SourceContentError("This file is empty.", "EMPTY_SOURCE");
  }
  return text;
}

/** Strips navigation, scripts, styles and footers before reading the page's
 * text, so the indexed content is the article, not the site chrome. */
export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $("nav, script, style, footer").remove();
  const text = $("body").length > 0 ? $("body").text() : $.root().text();
  if (!text.trim()) {
    throw new SourceContentError("This page has no readable text content.", "EMPTY_SOURCE");
  }
  return text;
}
