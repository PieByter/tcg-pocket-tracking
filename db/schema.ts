import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  friendCode: text("friend_code"),
  minEx: integer("min_ex").notNull().default(2),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    setCode: text("set_code").notNull(),
    setName: text("set_name").notNull(),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    rarityCode: text("rarity_code").notNull(),
    rarityLabel: text("rarity_label").notNull(),
    rarityGroup: text("rarity_group").notNull(),
    rarityRank: integer("rarity_rank").notNull(),
    rarityScore: integer("rarity_score").notNull(),
    kind: text("kind").notNull().$type<"ex" | "trainer" | "other">(),
    shareable: boolean("shareable").notNull(),
    tradable: boolean("tradable").notNull(),
    element: text("element"),
    imageUrl: text("image_url").notNull(),
  },
  (t) => [
    index("cards_set_idx").on(t.setCode, t.number),
    index("cards_kind_idx").on(t.kind),
    index("cards_name_idx").on(t.name),
  ],
);

export const holdings = pgTable(
  "holdings",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(0),
    targetQty: integer("target_qty").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.cardId] }),
    check("holdings_qty_non_negative", sql`${t.qty} >= 0`),
    check("holdings_target_non_negative", sql`${t.targetQty} >= 0`),
  ],
);

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    method: text("method").notNull().$type<"share" | "trade">(),
    fromAccountId: uuid("from_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    toAccountId: uuid("to_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    cardOutId: text("card_out_id")
      .notNull()
      .references(() => cards.id, { onDelete: "restrict" }),
    cardInId: text("card_in_id").references(() => cards.id, { onDelete: "restrict" }),
    status: text("status")
      .notNull()
      .default("planned")
      .$type<"planned" | "sent" | "confirmed" | "cancelled">(),
    plannedDay: date("planned_day", { mode: "string" }),
    gameDay: date("game_day", { mode: "string" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("transfers_status_idx").on(t.status),
    index("transfers_game_day_idx").on(t.gameDay),
    check("transfers_distinct_accounts", sql`${t.fromAccountId} <> ${t.toAccountId}`),
    check(
      "transfers_status_valid",
      sql`${t.status} in ('planned', 'sent', 'confirmed', 'cancelled')`,
    ),
    check("transfers_method_valid", sql`${t.method} in ('share', 'trade')`),
    check(
      "transfers_trade_has_card_in",
      sql`${t.method} = 'share' or ${t.cardInId} is not null`,
    ),
  ],
);

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type TransferStatus = Transfer["status"];
export type TransferMethod = Transfer["method"];
