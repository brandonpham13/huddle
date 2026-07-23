CREATE TABLE "huddle_countdown_config" (
	"huddle_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"target_at" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "huddle_countdown_config" ADD CONSTRAINT "huddle_countdown_config_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;