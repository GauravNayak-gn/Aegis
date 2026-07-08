CREATE TABLE "account" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "action" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"kind" text NOT NULL,
	"target" text,
	"detail" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"repository_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"action" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "repository" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"github_repo_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"webhook_secret" text,
	"webhook_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"action_filter" text,
	"match_field" text,
	"match_op" text,
	"match_value" text,
	"add_label" text,
	"post_comment" text,
	"slack_notify" text,
	"ai_triage" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository" ADD CONSTRAINT "repository_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;