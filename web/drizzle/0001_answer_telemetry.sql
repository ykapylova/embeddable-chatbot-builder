CREATE TYPE "public"."answer_status" AS ENUM('answered', 'abstained', 'no_context', 'quota', 'aborted', 'error');--> statement-breakpoint
CREATE TYPE "public"."source_error_code" AS ENUM('PARSE_FAILED', 'EMBEDDING_FAILED', 'TIMEOUT', 'UNSUPPORTED_CONTENT', 'EMPTY_SOURCE', 'STORAGE_FAILED', 'LIMIT_CHARS', 'UNKNOWN');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "answer_status" "answer_status";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cache_hit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retrieval_count" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "top_score" real;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retrieval_ms" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "first_token_ms" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "error_code" "source_error_code";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "index_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_request_idx" ON "messages" USING btree ("conversation_id","request_id");--> statement-breakpoint
DROP INDEX IF EXISTS "messages_gaps_idx";--> statement-breakpoint
-- A content gap is now the recorded status, not an empty citation list. The
-- `answer_status IS NULL` arm keeps rows written before this migration visible
-- on the Content Gaps screen instead of silently emptying it.
CREATE INDEX "messages_gaps_idx" ON "messages" ("created_at" DESC)
  WHERE "role" = 'assistant'
    AND (
      "rating" = -1
      OR "answer_status" IN ('abstained', 'no_context')
      OR ("answer_status" IS NULL AND "citations" = '[]'::jsonb)
    );
