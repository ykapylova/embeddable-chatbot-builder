import { removeFromChatBucket } from "server/services/supabase-storage.service";

/** Exported for its own test: URL sources carry no blob, so the list is mostly holes. */
export function blobPathsToDiscard(storageKeys: (string | null | undefined)[]): string[] {
  return [...new Set(storageKeys.filter((key): key is string => Boolean(key)))];
}

/**
 * Deletes the stored blobs of sources whose rows are already gone.
 *
 * Runs after the delete, not before: a source the owner can still see must
 * never point at an object that no longer exists. It also never throws — the
 * delete they asked for has already succeeded, and turning an unreachable
 * bucket into a failed request would leave them with a source they cannot
 * remove. A leaked object costs storage; a delete that reports failure after
 * succeeding costs trust.
 */
export async function discardSourceBlobs(storageKeys: (string | null | undefined)[]): Promise<void> {
  const paths = blobPathsToDiscard(storageKeys);
  if (paths.length === 0) return;

  try {
    await removeFromChatBucket(paths);
  } catch (error) {
    console.error(
      "[discardSourceBlobs] left behind",
      paths.length,
      error instanceof Error ? error.message : error,
    );
  }
}
