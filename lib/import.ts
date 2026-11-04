import type { MessageKey } from "./i18n";
import { detectDelimiter, parseCsv } from "./csv";

export type ImportMode = "set" | "add";

export type ImportAccountRef = { id: string; name: string; sortOrder: number };
export type ImportCardRef = {
  id: string;
  setCode: string;
  number: number;
  name: string;
  kind: "ex" | "trainer" | "other";
};

export type ImportRow = {
  line: number;
  accountId: string;
  cardId: string;
  qty: number;
  targetQty?: number;
};

export type ImportIssue = {
  line: number;
  key: MessageKey;
  params?: Record<string, string | number>;
};

export type ParseResult = {
  rows: ImportRow[];
  issues: ImportIssue[];
  issueTotal: number;
  duplicates: number;
  ignored: number;
};

export const IMPORT_MAX_ROWS = 5000;
const ISSUE_LIMIT = 50;
const MAX_QTY = 99;

const HEADER_ALIASES: Record<"card" | "account" | "qty" | "target", string[]> = {
  card: ["card", "card_id", "cardid", "card_code", "code", "id", "kartu"],
  account: ["account", "account_name", "akun", "akun_nama"],
  qty: ["qty", "quantity", "jumlah", "count", "owned"],
  target: ["target", "target_qty", "targetqty", "target_jumlah", "targetqty"],
};

const HEADER_INDEX = new Map<string, "card" | "account" | "qty" | "target">();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
  "card" | "account" | "qty" | "target",
  string[],
][]) {
  for (const alias of aliases) HEADER_INDEX.set(alias, field);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

type Resolver = {
  card: (raw: string) => ImportCardRef | null;
  account: (raw: string) => ImportAccountRef | null;
};

function buildResolver(accounts: ImportAccountRef[], cards: ImportCardRef[]): Resolver {
  const byCardId = new Map<string, ImportCardRef>();
  const bySetNumber = new Map<string, ImportCardRef>();
  const byName = new Map<string, ImportCardRef[]>();
  const byAccountName = new Map<string, ImportAccountRef>();
  const byAccountShort = new Map<string, ImportAccountRef[]>();

  for (const card of cards) {
    byCardId.set(normalize(card.id), card);
    bySetNumber.set(`${normalize(card.setCode)}-${normalizeNumber(card.number)}`, card);
    const name = normalize(card.name);
    const bucket = byName.get(name);
    if (bucket) bucket.push(card);
    else byName.set(name, [card]);
  }

  const ordered = [...accounts].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  for (const account of ordered) {
    byAccountName.set(normalize(account.name), account);
    const short = normalize(account.name.replace(/^Akun \d+:\s*/i, ""));
    if (!short) continue;
    const bucket = byAccountShort.get(short);
    if (bucket) bucket.push(account);
    else byAccountShort.set(short, [account]);
  }

  return {
    card(raw) {
      const value = raw.trim();
      if (!value) return null;
      const direct = byCardId.get(normalize(value));
      if (direct) return direct;

      const setNumber = /^(.*)-(\d+)$/.exec(value);
      if (setNumber) {
        const found = bySetNumber.get(`${normalize(setNumber[1])}-${Number(setNumber[2])}`);
        if (found) return found;
      }

      const byCardName = byName.get(normalize(value));
      if (byCardName?.length === 1) return byCardName[0];
      return null;
    },
    account(raw) {
      const value = raw.trim();
      if (!value) return null;
      const direct = byAccountName.get(normalize(value));
      if (direct) return direct;

      const index = /^#?(\d+)$/.exec(value);
      if (index) {
        const position = Number(index[1]);
        if (position >= 1 && position <= ordered.length) return ordered[position - 1];
      }

      const short = byAccountShort.get(normalize(value));
      if (short?.length === 1) return short[0];
      return null;
    },
  };
}

function parseQty(raw: string | undefined): { value: number } | { error: true } {
  if (raw === undefined) return { error: true };
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return { error: true };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { error: true };
  return { value: Math.min(MAX_QTY, value) };
}

function mapHeader(cells: string[]): Partial<Record<"card" | "account" | "qty" | "target", number>> {
  const map: Partial<Record<"card" | "account" | "qty" | "target", number>> = {};
  cells.forEach((cell, index) => {
    const field = HEADER_INDEX.get(normalize(cell).replace(/\s+/g, "_"));
    if (field && map[field] === undefined) map[field] = index;
  });
  return map;
}

/**
 * Parse CSV/paste menjadi baris impor. Baris yang tidak valid dilaporkan lewat `issues`
 * (dengan key i18n + nomor baris asli) dan tidak ikut diimpor.
 */
export function parseCollection(
  text: string,
  accounts: ImportAccountRef[],
  cards: ImportCardRef[],
  mode: ImportMode = "set",
): ParseResult {
  const result: ParseResult = { rows: [], issues: [], issueTotal: 0, duplicates: 0, ignored: 0 };
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return result;

  const pushIssue = (line: number, key: MessageKey, params?: Record<string, string | number>) => {
    result.issueTotal += 1;
    if (result.issues.length < ISSUE_LIMIT) result.issues.push({ line, key, params });
  };

  const delimiter = detectDelimiter(trimmed);
  const table = parseCsv(trimmed, delimiter);
  const resolver = buildResolver(accounts, cards);

  let startIndex = 0;
  let columns: Partial<Record<"card" | "account" | "qty" | "target", number>> = {
    card: 0,
    account: 1,
    qty: 2,
    target: 3,
  };

  const firstRow = table[0];
  if (firstRow) {
    const header = mapHeader(firstRow);
    const matched = Object.keys(header).length;
    if (matched >= 2 && header.card !== undefined && header.account !== undefined) {
      if (header.qty === undefined) {
        pushIssue(1, "import.error.header");
        return result;
      }
      columns = header;
      startIndex = 1;
    } else if (matched >= 2) {
      pushIssue(1, "import.error.header");
      return result;
    }
  }

  const merged = new Map<string, ImportRow>();

  for (let index = startIndex; index < table.length; index += 1) {
    const cells = table[index];
    const line = index + 1;
    if (cells.every((cell) => cell.trim() === "")) continue;
    if (cells[0]?.trim().startsWith("#")) {
      result.ignored += 1;
      continue;
    }

    const cardRaw = cells[columns.card ?? 0] ?? "";
    const accountRaw = cells[columns.account ?? 1] ?? "";
    const qtyRaw = cells[columns.qty ?? 2];
    const targetRaw = columns.target === undefined ? undefined : cells[columns.target];

    if (!cardRaw.trim() || !accountRaw.trim()) {
      pushIssue(line, "import.error.columns", { line });
      continue;
    }

    const card = resolver.card(cardRaw);
    if (!card) {
      pushIssue(line, "import.error.card", { line, value: cardRaw.trim() });
      continue;
    }

    const account = resolver.account(accountRaw);
    if (!account) {
      pushIssue(line, "import.error.account", { line, value: accountRaw.trim() });
      continue;
    }

    const qty = parseQty(qtyRaw);
    if ("error" in qty) {
      pushIssue(line, "import.error.qty", { line, value: qtyRaw?.trim() ?? "" });
      continue;
    }

    let targetQty: number | undefined;
    if (targetRaw !== undefined && targetRaw.trim() !== "") {
      const parsedTarget = parseQty(targetRaw);
      if ("error" in parsedTarget) {
        pushIssue(line, "import.error.qty", { line, value: targetRaw.trim() });
        continue;
      }
      targetQty = parsedTarget.value;
    }

    const key = `${account.id}|${card.id}`;
    const existing = merged.get(key);
    if (existing) {
      result.duplicates += 1;
      if (mode === "add") existing.qty = Math.min(MAX_QTY, existing.qty + qty.value);
      else existing.qty = qty.value;
      if (targetQty !== undefined) existing.targetQty = targetQty;
      continue;
    }

    if (merged.size >= IMPORT_MAX_ROWS) {
      pushIssue(line, "import.error.tooMany", { count: IMPORT_MAX_ROWS });
      result.rows = [...merged.values()];
      return result;
    }

    merged.set(key, {
      line,
      accountId: account.id,
      cardId: card.id,
      qty: qty.value,
      targetQty,
    });
  }

  result.rows = [...merged.values()];
  return result;
}
