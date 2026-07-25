CREATE TYPE "public"."poll_results_visibility" AS ENUM('always', 'after_vote');--> statement-breakpoint
CREATE TABLE "huddle_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"topic_id" uuid,
	"is_dashboard_poll" boolean DEFAULT false NOT NULL,
	"question" text NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"allow_vote_changes" boolean DEFAULT true NOT NULL,
	"results_visibility" "poll_results_visibility" DEFAULT 'always' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "huddle_poll_options" ADD CONSTRAINT "huddle_poll_options_poll_id_huddle_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."huddle_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_poll_votes" ADD CONSTRAINT "huddle_poll_votes_poll_id_huddle_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."huddle_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_poll_votes" ADD CONSTRAINT "huddle_poll_votes_option_id_huddle_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."huddle_poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_polls" ADD CONSTRAINT "huddle_polls_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_polls" ADD CONSTRAINT "huddle_polls_topic_id_huddle_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."huddle_forum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "huddle_poll_options_poll_idx" ON "huddle_poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "huddle_poll_votes_poll_user_idx" ON "huddle_poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "huddle_poll_votes_option_user_uniq" ON "huddle_poll_votes" USING btree ("option_id","user_id");--> statement-breakpoint
CREATE INDEX "huddle_polls_topic_idx" ON "huddle_polls" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "huddle_polls_dashboard_active_uniq" ON "huddle_polls" USING btree ("huddle_id") WHERE "huddle_polls"."is_dashboard_poll" = true;