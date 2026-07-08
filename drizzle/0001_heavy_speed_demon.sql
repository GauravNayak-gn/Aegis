ALTER TABLE "rule" ALTER COLUMN "slack_notify" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "rule" ALTER COLUMN "slack_notify" SET NOT NULL;