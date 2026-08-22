import { getSignedUrlForPath } from "server/services/supabase-storage.service";

import { SourceContentError } from "./errors";

const DOWNLOAD_URL_TTL_SEC = 300;

/** Reads a previously uploaded source file back out of storage — used on
 * reindex, when the original request body is long gone. */
export async function downloadFromChatBucket(objectPath: string): Promise<Buffer> {
  let signedUrl: string;
  try {
    signedUrl = await getSignedUrlForPath(objectPath, DOWNLOAD_URL_TTL_SEC);
  } catch (error) {
    console.error("[downloadFromChatBucket] signed url", error instanceof Error ? error.message : error);
    throw new SourceContentError("Could not read the stored content for this source.", "STORAGE_FAILED");
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new SourceContentError("Could not read the stored content for this source.", "STORAGE_FAILED");
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}
