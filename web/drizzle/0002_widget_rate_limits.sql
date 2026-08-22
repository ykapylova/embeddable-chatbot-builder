CREATE TABLE "widget_generation_slots" (
	"bot_id" uuid NOT NULL,
	"slot_no" integer NOT NULL,
	"token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_generation_slots" ADD CONSTRAINT "widget_generation_slots_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "widget_generation_slots_pk" ON "widget_generation_slots" USING btree ("bot_id","slot_no");--> statement-breakpoint
CREATE INDEX "widget_rate_limits_expires_at_idx" ON "widget_rate_limits" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "widget_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "widget_generation_slots" ENABLE ROW LEVEL SECURITY;
