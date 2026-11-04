import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, toCsv } from "@/lib/csv";
import { IMPORT_MAX_ROWS, parseCollection, type ImportCardRef } from "@/lib/import";

const accounts = [
  { id: "acc-1", name: "Akun 1: Main", sortOrder: 0 },
  { id: "acc-2", name: "Akun 2: Kanto Rush", sortOrder: 1 },
];

const cards: ImportCardRef[] = [
  { id: "A1-1", setCode: "A1", number: 1, name: "Bulbasaur", kind: "other" },
  { id: "A1-4", setCode: "A1", number: 4, name: "Charmander", kind: "other" },
  { id: "PROMO-A-3", setCode: "PROMO-A", number: 3, name: "Potion", kind: "trainer" },
  { id: "A1-99", setCode: "A1", number: 99, name: "Pikachu", kind: "other" },
  { id: "A1-100", setCode: "A1", number: 100, name: "Pikachu", kind: "other" },
];

describe("csv", () => {
  it("meng-escape dan membaca kembali kutip, koma, dan baris baru", () => {
    const rows = [
      ["a", 'b,c'],
      ['d"e', "f\ng"],
    ];
    const text = toCsv(rows);
    expect(parseCsv(text, ",")).toEqual(rows);
  });

  it("mendeteksi delimiter dari baris pertama", () => {
    expect(detectDelimiter("card;account;qty")).toBe(";");
    expect(detectDelimiter("card\taccount\tqty")).toBe("\t");
    expect(detectDelimiter("card,account,qty")).toBe(",");
  });
});

describe("parseCollection", () => {
  it("membaca baris posisional tanpa header", () => {
    const result = parseCollection("A1-1,Akun 1: Main,2,1\nA1-4,Akun 2: Kanto Rush,1", accounts, cards);
    expect(result.issues).toHaveLength(0);
    expect(result.rows).toEqual([
      { line: 1, accountId: "acc-1", cardId: "A1-1", qty: 2, targetQty: 1 },
      { line: 2, accountId: "acc-2", cardId: "A1-4", qty: 1, targetQty: undefined },
    ]);
  });

  it("menerima header hasil ekspor dengan kolom tambahan", () => {
    const text = [
      "card_id,set_code,number,name,rarity,account,qty,target_qty",
      "A1-1,A1,1,Bulbasaur,◇1,Akun 1: Main,2,1",
    ].join("\n");
    const result = parseCollection(text, accounts, cards);
    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ cardId: "A1-1", accountId: "acc-1", qty: 2, targetQty: 1 });
  });

  it("mendukung tab dan titik koma serta nomor akun/set-number", () => {
    const tabs = parseCollection("A1-001\t#2\t3", accounts, cards);
    expect(tabs.issues).toHaveLength(0);
    expect(tabs.rows[0]).toMatchObject({ cardId: "A1-1", accountId: "acc-2", qty: 3 });

    const semicolons = parseCollection("PROMO-A-3;Main;2", accounts, cards);
    expect(semicolons.issues).toHaveLength(0);
    expect(semicolons.rows[0]).toMatchObject({ cardId: "PROMO-A-3", accountId: "acc-1", qty: 2 });
  });

  it("mencocokkan nama kartu yang unik dan melaporkan yang ambigu", () => {
    const unique = parseCollection("Potion,Akun 1: Main,1", accounts, cards);
    expect(unique.rows[0]?.cardId).toBe("PROMO-A-3");

    const ambiguous = parseCollection("Pikachu,Akun 1: Main,1", accounts, cards);
    expect(ambiguous.rows).toHaveLength(0);
    expect(ambiguous.issues[0]).toMatchObject({ line: 1, key: "import.error.card", params: { value: "Pikachu" } });
  });

  it("melaporkan kartu, akun, dan qty yang tidak valid tanpa membuang baris lain", () => {
    const text = ["XXX-9,Akun 1: Main,1", "A1-1,Akun 9,1", "A1-1,Akun 1: Main,abc", "A1-4,#1,2"].join("\n");
    const result = parseCollection(text, accounts, cards);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ line: 4, cardId: "A1-4", qty: 2 });
    expect(result.issues.map((issue) => issue.key)).toEqual([
      "import.error.card",
      "import.error.account",
      "import.error.qty",
    ]);
  });

  it("menggabungkan duplikat: set = baris terakhir, add = dijumlahkan", () => {
    const text = "A1-1,Akun 1: Main,2\nA1-1,Akun 1: Main,3";
    expect(parseCollection(text, accounts, cards, "set").rows[0]).toMatchObject({ qty: 3 });
    expect(parseCollection(text, accounts, cards, "add").rows[0]).toMatchObject({ qty: 5 });
    expect(parseCollection(text, accounts, cards, "add").duplicates).toBe(1);
  });

  it("membatasi qty maksimal 99 dan mengabaikan komentar/baris kosong", () => {
    const text = ["# catatan", "", "A1-1,Akun 1: Main,120"].join("\n");
    const result = parseCollection(text, accounts, cards);
    expect(result.rows[0]).toMatchObject({ qty: 99 });
    expect(result.ignored).toBe(1);
  });

  it("menolak header yang kehilangan kolom qty", () => {
    const result = parseCollection("card,account\nA1-1,Akun 1: Main", accounts, cards);
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ line: 1, key: "import.error.header" });
  });

  it("berhenti menambah baris saat melewati batas", () => {
    const many: ImportCardRef[] = Array.from({ length: IMPORT_MAX_ROWS + 5 }, (_, index) => ({
      id: `T-${index + 1}`,
      setCode: "T",
      number: index + 1,
      name: `Test ${index + 1}`,
      kind: "other" as const,
    }));
    const lines = many.map((card) => `${card.id},Akun 1: Main,1`);
    const result = parseCollection(lines.join("\n"), accounts, many);
    expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
    expect(result.issues.some((issue) => issue.key === "import.error.tooMany")).toBe(true);
  });

  it("mengembalikan hasil kosong untuk teks kosong", () => {
    expect(parseCollection("   \n  ", accounts, cards)).toMatchObject({ rows: [], issues: [] });
  });
});
