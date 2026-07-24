CREATE TABLE "huddle_forum_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"huddle_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "huddle_forum_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "huddle_forum_replies" ADD CONSTRAINT "huddle_forum_replies_topic_id_huddle_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."huddle_forum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_forum_replies" ADD CONSTRAINT "huddle_forum_replies_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_forum_topics" ADD CONSTRAINT "huddle_forum_topics_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "huddle_forum_replies_topic_idx" ON "huddle_forum_replies" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "huddle_forum_topics_huddle_updated_idx" ON "huddle_forum_topics" USING btree ("huddle_id","updated_at");