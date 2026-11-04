"use client";

import type { Card, TransferStatus } from "@/db/schema";
import { rarityChipClass, rarityLabel, rarityShort } from "@/lib/cards";
import { useI18n } from "./i18n-provider";

export function RarityChip({ card }: { card: Card }) {
  return (
    <span className={`chip ${rarityChipClass(card)}`} title={rarityLabel(card)}>
      {rarityShort(card)}
    </span>
  );
}

export function MethodBadge({ method }: { method: "share" | "trade" }) {
  const { t } = useI18n();
  return method === "share" ? (
    <span className="chip border-primary/30 bg-primary/10 text-primary">{t("badge.share")}</span>
  ) : (
    <span className="chip border-secondary/30 bg-secondary/10 text-secondary">{t("badge.trade")}</span>
  );
}

const statusStyles: Record<TransferStatus, string> = {
  planned: "border-secondary/30 bg-secondary/10 text-secondary",
  sent: "border-primary/30 bg-primary/10 text-primary",
  confirmed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const statusKeys = {
  planned: "transfer.status.planned",
  sent: "transfer.status.sent",
  confirmed: "transfer.status.confirmed",
  cancelled: "transfer.status.cancelled",
} as const;

export function StatusBadge({ status }: { status: TransferStatus }) {
  const { t } = useI18n();
  return (
    <span className={`chip ${statusStyles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(statusKeys[status])}
    </span>
  );
}
