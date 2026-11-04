"use client";

import { useMemo, useState, useTransition } from "react";
import { saveHoldings } from "@/app/actions";
import type { Account } from "@/db/schema";
import type { InventoryRow } from "@/lib/queries";
import { RarityChip } from "./badges";
import { CardImage } from "./card-image";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

type Cell = { qty: number; targetQty: number };

const cellKey = (accountId: string, cardId: string) => `${accountId}|${cardId}`;

export function InventoryMatrix({
  rows,
  accounts,
  defaultTargetHint,
  focusAccountId,
}: {
  rows: InventoryRow[];
  accounts: Account[];
  defaultTargetHint: { ex: number; trainer: number };
  focusAccountId?: string;
}) {
  const { t } = useI18n();

  const initial = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const row of rows) {
      for (const account of accounts) {
        const cell = row.perAccount[account.id] ?? { qty: 0, targetQty: 0 };
        map.set(cellKey(account.id, row.card.id), cell);
      }
    }
    return map;
  }, [rows, accounts]);

  const [draft, setDraft] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Data server berubah (setelah simpan/filter): reset draft selama render,
  // tanpa effect, supaya tidak ada render ganda.
  if (syncedFrom !== initial) {
    setSyncedFrom(initial);
    setDraft(initial);
  }

  const changes = useMemo(() => {
    const list: { accountId: string; cardId: string; qty: number; targetQty?: number }[] = [];
    for (const row of rows) {
      for (const account of accounts) {
        const key = cellKey(account.id, row.card.id);
        const before = initial.get(key);
        const after = draft.get(key);
        if (!before || !after) continue;
        if (before.qty === after.qty && before.targetQty === after.targetQty) continue;
        list.push({
          accountId: account.id,
          cardId: row.card.id,
          qty: after.qty,
          // `0` berarti belum diset (pakai default), jadi hanya kirim target
          // bila user benar-benar mengubahnya.
          targetQty: before.targetQty === after.targetQty ? undefined : after.targetQty,
        });
      }
    }
    return list;
  }, [rows, accounts, draft, initial]);

  const update = (accountId: string, cardId: string, patch: Partial<Cell>) => {
    setDraft((current) => {
      const next = new Map(current);
      const key = cellKey(accountId, cardId);
      const cell = next.get(key) ?? { qty: 0, targetQty: 0 };
      next.set(key, {
        qty: Math.max(0, Math.min(99, patch.qty ?? cell.qty)),
        targetQty: Math.max(0, Math.min(9, patch.targetQty ?? cell.targetQty)),
      });
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveHoldings(changes);
      setMessage({ ok: result.ok, text: t(result.key, result.params) });
    });
  };

  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-surface-container-lowest/70 text-left">
                <th className="sticky left-0 z-10 min-w-[260px] bg-surface-container-lowest px-3 py-2 font-mono text-label-sm uppercase tracking-[0.12em] text-outline">
                  {t("inventory.table.card")}
                </th>
                {accounts.map((account) => (
                  <th
                    key={account.id}
                    className={`min-w-[124px] px-2 py-2 align-bottom ${
                      focusAccountId === account.id ? "bg-primary/[0.07]" : ""
                    }`}
                  >
                    <span className="block truncate font-display text-xs text-on-surface">
                      {account.name.replace(/^Akun \d+:\s*/, "")}
                    </span>
                    <span className="block font-mono text-label-sm text-outline">
                      {t("inventory.table.minEx", { min: account.minEx })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.card.id} className="border-b border-white/[0.05] transition hover:bg-primary/[0.04]">
                  <td className="sticky left-0 z-10 bg-surface-container-low/95 px-3 py-2 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <CardImage
                        src={row.card.imageUrl}
                        alt={row.card.name}
                        className="h-14 w-10 shrink-0"
                        sizes="40px"
                        priority={rowIndex < 4}
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm text-on-surface">
                          {row.card.name}
                          <RarityChip card={row.card} />
                        </p>
                        <p className="mt-0.5 truncate font-mono text-label-sm text-outline">
                          {t(
                            row.card.kind === "ex"
                              ? "inventory.kind.ex"
                              : row.card.kind === "trainer"
                                ? "inventory.kind.trainer"
                                : "inventory.kind.other",
                          )}{" "}
                          · {row.card.setName} ({row.card.setCode}) · #
                          {String(row.card.number).padStart(3, "0")}
                        </p>
                      </div>
                    </div>
                  </td>

                  {accounts.map((account) => {
                    const key = cellKey(account.id, row.card.id);
                    const cell = draft.get(key) ?? { qty: 0, targetQty: 0 };
                    const original = initial.get(key) ?? cell;
                    const changed = cell.qty !== original.qty || cell.targetQty !== original.targetQty;
                    const fallback =
                      row.card.kind === "trainer" ? defaultTargetHint.trainer : defaultTargetHint.ex;
                    const target = cell.targetQty || fallback;
                    const shortAccount = account.name.replace(/^Akun \d+:\s*/, "");

                    return (
                      <td
                        key={account.id}
                        className={`px-2 py-2 align-middle ${
                          focusAccountId === account.id ? "bg-primary/[0.04]" : ""
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 rounded-lg border px-1 py-0.5 ${
                            changed
                              ? "border-primary/50 bg-primary/[0.08]"
                              : "border-white/[0.06] bg-surface-container-lowest/60"
                          }`}
                        >
                          <StepperButton
                            label={t("inventory.stepper.minus", {
                              card: row.card.name,
                              account: shortAccount,
                            })}
                            onClick={() => update(account.id, row.card.id, { qty: cell.qty - 1 })}
                          >
                            <Icon name="minus" className="h-3 w-3" />
                          </StepperButton>
                          <span
                            className={`w-6 text-center font-mono text-sm ${
                              cell.qty < target ? "text-rose-300" : cell.qty > target ? "text-primary" : "text-on-surface"
                            }`}
                          >
                            {cell.qty}
                          </span>
                          <StepperButton
                            label={t("inventory.stepper.plus", {
                              card: row.card.name,
                              account: shortAccount,
                            })}
                            onClick={() => update(account.id, row.card.id, { qty: cell.qty + 1 })}
                          >
                            <Icon name="plus" className="h-3 w-3" />
                          </StepperButton>
                          <input
                            aria-label={t("inventory.target.label", {
                              card: row.card.name,
                              account: shortAccount,
                            })}
                            type="number"
                            min={0}
                            max={9}
                            value={cell.targetQty}
                            placeholder={String(fallback)}
                            onChange={(event) =>
                              update(account.id, row.card.id, { targetQty: Number(event.target.value) })
                            }
                            className="w-8 rounded border border-white/10 bg-transparent px-0.5 py-0.5 text-center font-mono text-[11px] text-outline outline-none focus:border-primary focus:text-on-surface"
                            title={t("inventory.target.title")}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel sticky bottom-16 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 lg:bottom-4">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-label-md ${
              changes.length > 0 ? "text-secondary" : "text-outline"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${changes.length > 0 ? "bg-secondary" : "bg-success"}`} />
            {t("inventory.dirty", { count: changes.length })}
          </span>
          {message && <span className={message.ok ? "text-success" : "text-rose-300"}>{message.text}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={changes.length === 0 || pending}
            onClick={() => {
              setDraft(initial);
              setMessage(null);
            }}
          >
            <Icon name="x" className="h-4 w-4" />
            {t("inventory.discard")}
          </button>
          <button type="button" className="btn-primary" disabled={changes.length === 0 || pending} onClick={save}>
            {pending ? <Icon name="repeat" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
            {pending ? t("common.saving") : t("inventory.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepperButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-6 w-6 shrink-0 place-items-center rounded border border-white/10 bg-white/5 text-on-surface-variant transition hover:border-primary/50 hover:text-primary"
    >
      {children}
    </button>
  );
}
