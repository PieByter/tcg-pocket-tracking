ALTER TABLE "accounts" ADD COLUMN "trade_stamina" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "shinedust" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "resources_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_stamina_non_negative" CHECK ("accounts"."trade_stamina" >= 0);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_shinedust_non_negative" CHECK ("accounts"."shinedust" >= 0);