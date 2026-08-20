import type { Bot, BotListItem, CreateBotBody, UpdateBotBody } from "lib/api-types/bot";
import type { CreateJsonSourceBody, Source } from "lib/api-types/source";
import { apiPaths } from "./api-paths";

const jsonHeaders = { "Content-Type": "application/json" };

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function parseErrorMessage(res: Response, json: unknown): string {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof (json as { error: unknown }).error === "string"
  ) {
    return (json as { error: string }).error;
  }
  return `Request failed (${res.status})`;
}

function readErrorCode(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  if ("code" in json && typeof (json as { code: unknown }).code === "string") {
    return (json as { code: string }).code;
  }
  return undefined;
}

export async function readApiError(res: Response): Promise<ApiError> {
  const json: unknown = await res.json().catch(() => ({}));
  return new ApiError(parseErrorMessage(res, json), res.status, readErrorCode(json));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(parseErrorMessage(res, json), res.status, readErrorCode(json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

async function requestAck(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(path, { credentials: "include", ...init });
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(parseErrorMessage(res, json), res.status, readErrorCode(json));
  }
  if (
    !json ||
    typeof json !== "object" ||
    (json as { success?: unknown }).success !== true
  ) {
    throw new Error("Invalid API response");
  }
}

export function getBots(): Promise<BotListItem[]> {
  return request<BotListItem[]>(apiPaths.bots());
}

export function getBot(botId: string): Promise<Bot> {
  return request<Bot>(apiPaths.bot(botId));
}

export function createBot(body: CreateBotBody): Promise<Bot> {
  return request<Bot>(apiPaths.bots(), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export function updateBot(botId: string, body: UpdateBotBody): Promise<Bot> {
  return request<Bot>(apiPaths.bot(botId), {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export function deleteBot(botId: string): Promise<void> {
  return requestAck(apiPaths.bot(botId), { method: "DELETE" });
}

export function getSources(botId: string): Promise<Source[]> {
  return request<Source[]>(apiPaths.sources(botId));
}

export function createSource(botId: string, body: CreateJsonSourceBody): Promise<Source> {
  return request<Source>(apiPaths.sources(botId), {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export function createFileSource(botId: string, formData: FormData): Promise<Source> {
  return request<Source>(apiPaths.sources(botId), { method: "POST", body: formData });
}

export function deleteSource(botId: string, sourceId: string): Promise<void> {
  return requestAck(apiPaths.source(botId, sourceId), { method: "DELETE" });
}

export function reindexSource(botId: string, sourceId: string): Promise<Source> {
  return request<Source>(apiPaths.sourceReindex(botId, sourceId), { method: "POST" });
}
