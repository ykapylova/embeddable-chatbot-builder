export type SourceType = "file" | "url" | "text" | "faq";
export type SourceStatus = "pending" | "processing" | "ready" | "failed";

export type Source = {
  id: string;
  botId: string;
  type: SourceType;
  title: string;
  sourceUrl: string | null;
  status: SourceStatus;
  error: string | null;
  charCount: number;
  chunkCount: number;
  createdAt: string;
  indexedAt: string | null;
};

export type CreateUrlSourceBody = { type: "url"; url: string };
export type CreateTextSourceBody = { type: "text"; title: string; content: string };
export type CreateFaqSourceBody = { type: "faq"; question: string; answer: string };

/** Sent as JSON. A `file` source is sent as `multipart/form-data` instead,
 * with fields `type=file`, `file` (the binary) and an optional `title`. */
export type CreateJsonSourceBody = CreateUrlSourceBody | CreateTextSourceBody | CreateFaqSourceBody;
