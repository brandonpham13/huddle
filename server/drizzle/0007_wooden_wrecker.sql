CREATE TYPE "public"."survey_question_type" AS ENUM('short_text', 'paragraph', 'multiple_choice', 'checkboxes');--> statement-breakpoint
CREATE TABLE "huddle_survey_answer_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"text_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_survey_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"prompt" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huddle_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huddle_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"closes_at" timestamp with time zone NOT NULL,
	"results_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "huddle_survey_answer_options" ADD CONSTRAINT "huddle_survey_answer_options_response_id_huddle_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."huddle_survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_answer_options" ADD CONSTRAINT "huddle_survey_answer_options_question_id_huddle_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."huddle_survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_answer_options" ADD CONSTRAINT "huddle_survey_answer_options_option_id_huddle_survey_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."huddle_survey_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_answers" ADD CONSTRAINT "huddle_survey_answers_response_id_huddle_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."huddle_survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_answers" ADD CONSTRAINT "huddle_survey_answers_question_id_huddle_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."huddle_survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_options" ADD CONSTRAINT "huddle_survey_options_question_id_huddle_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."huddle_survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_questions" ADD CONSTRAINT "huddle_survey_questions_survey_id_huddle_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."huddle_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_survey_responses" ADD CONSTRAINT "huddle_survey_responses_survey_id_huddle_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."huddle_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huddle_surveys" ADD CONSTRAINT "huddle_surveys_huddle_id_huddles_id_fk" FOREIGN KEY ("huddle_id") REFERENCES "public"."huddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "huddle_survey_answer_options_question_idx" ON "huddle_survey_answer_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "huddle_survey_answer_options_response_option_uniq" ON "huddle_survey_answer_options" USING btree ("response_id","option_id");--> statement-breakpoint
CREATE INDEX "huddle_survey_answers_response_idx" ON "huddle_survey_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "huddle_survey_answers_question_idx" ON "huddle_survey_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "huddle_survey_options_question_idx" ON "huddle_survey_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "huddle_survey_questions_survey_idx" ON "huddle_survey_questions" USING btree ("survey_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "huddle_survey_responses_survey_user_uniq" ON "huddle_survey_responses" USING btree ("survey_id","user_id");--> statement-breakpoint
CREATE INDEX "huddle_surveys_huddle_created_idx" ON "huddle_surveys" USING btree ("huddle_id","created_at");