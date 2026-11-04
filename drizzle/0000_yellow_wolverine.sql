CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"friend_code" text,
	"min_ex" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set_code" text NOT NULL,
	"set_name" text NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"rarity_code" text NOT NULL,
	"rarity_label" text NOT NULL,
	"rarity_group" text NOT NULL,
	"rarity_rank" integer NOT NULL,
	"rarity_score" integer NOT NULL,
	"kind" text NOT NULL,
	"shareable" boolean NOT NULL,
	"tradable" boolean NOT NULL,
	"element" text,
	"image_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"account_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"target_qty" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_account_id_card_id_pk" PRIMARY KEY("account_id","card_id"),
	CONSTRAINT "holdings_qty_non_negative" CHECK ("holdings"."qty" >= 0),
	CONSTRAINT "holdings_target_non_negative" CHECK ("holdings"."target_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" text NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"card_out_id" text NOT NULL,
	"card_in_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"planned_day" date,
	"game_day" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "transfers_distinct_accounts" CHECK ("transfers"."from_account_id" <> "transfers"."to_account_id"),
	CONSTRAINT "transfers_status_valid" CHECK ("transfers"."status" in ('planned', 'sent', 'confirmed', 'cancelled')),
	CONSTRAINT "transfers_method_valid" CHECK ("transfers"."method" in ('share', 'trade')),
	CONSTRAINT "transfers_trade_has_card_in" CHECK ("transfers"."method" = 'share' or "transfers"."card_in_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_card_out_id_cards_id_fk" FOREIGN KEY ("card_out_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_card_in_id_cards_id_fk" FOREIGN KEY ("card_in_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_set_idx" ON "cards" USING btree ("set_code","number");--> statement-breakpoint
CREATE INDEX "cards_kind_idx" ON "cards" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "cards_name_idx" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_game_day_idx" ON "transfers" USING btree ("game_day");