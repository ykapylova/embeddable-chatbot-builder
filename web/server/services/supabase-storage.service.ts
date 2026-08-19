import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";

let cachedClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = env.supabaseUrl;
  const key = env.supabaseServiceRoleKey;
  if (!url || !key) {
    throw new Error("Supabase storage is not configured");
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function getStorageBucketName(): string {
  return env.supabaseStorageBucket;
}

export function isChatStorageConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function signedUrlTtlSec(): number {
  return env.supabaseSignedUrlTtlSec;
}

export async function uploadBytesToChatBucket(
  objectPath: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ path: string }> {
  const supabase = getServiceClient();
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("[supabase storage upload]", error);
    throw new Error(error.message || "Storage upload failed");
  }
  return { path: data.path };
}

export async function getSignedUrlForPath(objectPath: string, expiresInSec: number): Promise<string> {
  const supabase = getServiceClient();
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresInSec);
  if (error || !data?.signedUrl) {
    console.error("[supabase storage signed url]", error);
    throw new Error("Could not create signed URL");
  }
  return data.signedUrl;
}
