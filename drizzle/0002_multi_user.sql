-- Migrasi single-user → multi-user (Supabase Auth).
-- Kolom ditambah nullable dulu supaya database lokal lama tidak gagal,
-- baris lama diberi UUID sentinel yang tidak mungkin cocok dengan auth.users.

ALTER TABLE "app_config" DROP CONSTRAINT "app_config_pkey";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "accounts" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "app_config" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "transfers" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_user_id_key_pk" PRIMARY KEY("user_id","key");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transfers_user_idx" ON "transfers" USING btree ("user_id");