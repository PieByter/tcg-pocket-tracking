import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import {
  COLLECTION_HEADER,
  backupFileName,
  buildBackupJson,
  buildCollectionCsv,
  buildTransfersCsv,
} from "@/lib/export";
import { parseCollection, type ImportCardRef } from "@/lib/import";
import { account, card, settings } from "./fixtures";

const accounts = [
  account("acc-1", { name: "Akun 1: Main", sortOrder: 0 }),
  account("acc-2", { name: "Akun 2: Kanto Rush", sortOrder: 1 }),
];

const bulbasaur = card("A1-1", { name: "Bulbasaur", setCode: "A1", number: 1 });
const potion = card("PROMO-A-3", {
  name: "Potion",
  setCode: "PROMO-A",
  number: 3,
  kind: "trainer",
  rarityGroup: "Diamond",
  rarityRank: 1,
});

const holdings = [
  { accountId: "acc-1", cardId: "A1-1", qty: 2, targetQty: 1, updatedAt: new Date("2026-11-01T00:00:00Z"), card: bulbasaur },
  { accountId: "acc-2", cardId: "A1-1", qty: 0, targetQty: 1, updatedAt: new Date("2026-11-01T00:00:00Z"), card: bulbasaur },
  { accountId: "acc-2", cardId: "PROMO-A-3", qty: 4, targetQty: 2, updatedAt: new Date("2026-11-01T00:00:00Z"), card: potion },
];

describe("buildCollectionCsv", () => {
  it("menulis header yang bisa dibaca kembali oleh parser impor", () => {
    const csv = buildCollectionCsv(accounts, holdings);
    const rows = parseCsv(csv.replace(/^\uFEFF/, ""), ",");
    expect(rows[0]).toEqual(COLLECTION_HEADER);
    expect(rows).toHaveLength(4);

    const cardRefs: ImportCardRef[] = [bulbasaur, potion].map((item) => ({
      id: item.id,
      setCode: item.setCode,
      number: item.number,
      name: item.name,
      kind: item.kind,
    }));

    const parsed = parseCollection(csv, accounts, cardRefs);
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.rows).toEqual([
      { line: 2, accountId: "acc-1", cardId: "A1-1", qty: 2, targetQty: 1 },
      { line: 3, accountId: "acc-2", cardId: "A1-1", qty: 0, targetQty: 1 },
      { line: 4, accountId: "acc-2", cardId: "PROMO-A-3", qty: 4, targetQty: 2 },
    ]);
  });
});

describe("buildBackupJson", () => {
  it("memuat akun, kepemilikan, transfer, dan aturan", () => {
    const json = buildBackupJson({
      exportedAt: new Date("2026-11-04T05:00:00Z"),
      settings,
      accounts,
      holdings,
      transfers: [
        {
          id: "tx-1",
          userId: "user-1",
          method: "trade",
          fromAccountId: "acc-1",
          toAccountId: "acc-2",
          cardOutId: "A1-1",
          cardInId: "PROMO-A-3",
          status: "planned",
          plannedDay: "2026-11-04",
          gameDay: null,
          note: null,
          createdAt: new Date("2026-11-04T01:00:00Z"),
          updatedAt: new Date("2026-11-04T01:00:00Z"),
          sentAt: null,
          confirmedAt: null,
          cancelledAt: null,
          from: accounts[0],
          to: accounts[1],
          cardOut: bulbasaur,
          cardIn: potion,
        },
      ],
    });

    const payload = JSON.parse(json);
    expect(payload).toMatchObject({ app: "pocketledger", version: 1 });
    expect(payload.exportedAt).toBe("2026-11-04T05:00:00.000Z");
    expect(payload.accounts).toHaveLength(2);
    expect(payload.holdings[0]).toMatchObject({
      account: "Akun 1: Main",
      cardId: "A1-1",
      qty: 2,
      targetQty: 1,
    });
    expect(payload.transfers[0]).toMatchObject({
      from: "Akun 1: Main",
      to: "Akun 2: Kanto Rush",
      cardInName: "Potion",
    });
    expect(payload.settings.maxTradeStamina).toBe(settings.maxTradeStamina);
  });
});

describe("buildTransfersCsv", () => {
  it("meng-escape catatan yang berisi koma dan kutip", () => {
    const csv = buildTransfersCsv([
      {
        id: "tx-1",
        userId: "user-1",
        method: "share",
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        cardOutId: "A1-1",
        cardInId: null,
        status: "confirmed",
        plannedDay: null,
        gameDay: "2026-11-04",
        note: 'kirim "cepat", ya',
        createdAt: new Date("2026-11-04T01:00:00Z"),
        updatedAt: new Date("2026-11-04T01:00:00Z"),
        sentAt: null,
        confirmedAt: new Date("2026-11-04T02:00:00Z"),
        cancelledAt: null,
        from: accounts[0],
        to: accounts[1],
        cardOut: bulbasaur,
        cardIn: null,
      },
    ]);

    const rows = parseCsv(csv.replace(/^\uFEFF/, ""), ",");
    expect(rows).toHaveLength(2);
    expect(rows[1][12]).toBe('kirim "cepat", ya');
  });
});

describe("backupFileName", () => {
  it("memakai tanggal ekspor", () => {
    expect(backupFileName("collection", new Date("2026-11-04T05:00:00Z"), "csv")).toBe(
      "pocketledger-collection-2026-11-04.csv",
    );
  });
});
