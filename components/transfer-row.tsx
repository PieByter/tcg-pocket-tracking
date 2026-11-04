import Link from "next/link";
import { cancelTransfer, confirmTransfer, markTransferSent } from "@/app/actions";
import type { LedgerTransfer } from "@/lib/queries";
import { formatDateTime, shortId } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { ActionButton } from "./action-button";
import { MethodBadge, RarityChip, StatusBadge } from "./badges";
import { CardImage } from "./card-image";
import { Icon } from "./icon";

export async function TransferRow({
  transfer,
  timeZone,
  dense = false,
}: {
  transfer: LedgerTransfer;
  timeZone: string;
  dense?: boolean;
}) {
  const { locale, t } = await getI18n();
  const { cardOut, cardIn } = transfer;

  return (
    <div
      className={`grid grid-cols-1 gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto] md:items-center ${
        dense ? "md:py-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 md:block">
        <p className="font-mono text-label-md text-primary">{shortId(transfer.id)}</p>
        <p className="font-mono text-label-sm text-outline">
          {formatDateTime(transfer.createdAt, timeZone, locale)}
        </p>
        <div className="ml-auto md:hidden">
          <StatusBadge status={transfer.status} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
        <div className="min-w-0">
          <p className="truncate text-sm text-on-surface">{transfer.fromAccount.name}</p>
          <p className="truncate font-mono text-label-sm text-outline">
            {transfer.fromAccount.friendCode ?? t("transfer.noFriendCode")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {cardOut && (
          <CardImage src={cardOut.imageUrl} alt={cardOut.name} className="h-10 w-8 shrink-0" sizes="32px" />
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm text-on-surface">
            {cardOut?.name ?? t("transfer.cardMissing")}
            {cardOut && <RarityChip card={cardOut} />}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <MethodBadge method={transfer.method} />
            {cardIn && <span className="chip border-white/10 bg-white/5 text-on-surface-variant">↔ {cardIn.name}</span>}
          </div>
        </div>
        <Icon name="arrowRight" className="ml-auto h-4 w-4 shrink-0 text-outline md:hidden" />
      </div>

      <div className="flex items-center justify-between gap-2 md:justify-end">
        <div className="min-w-0 md:text-right">
          <p className="truncate text-sm text-on-surface">{transfer.toAccount.name}</p>
          <p className="font-mono text-label-sm text-outline">
            {transfer.gameDay
              ? t("transfer.gameDay", { day: transfer.gameDay })
              : transfer.plannedDay
                ? t("transfer.plannedDay", { day: transfer.plannedDay })
                : "—"}
          </p>
        </div>
        <div className="hidden md:block">
          <StatusBadge status={transfer.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 md:min-w-[220px]">
        {transfer.status === "planned" && (
          <>
            <ActionButton
              action={markTransferSent}
              fields={{ id: transfer.id }}
              label={t("transfer.action.send")}
              pendingLabel={t("common.saving")}
              variant="primary"
              icon="send"
              explain
              className="!px-2.5 !py-1.5 !text-xs"
            />
            <ActionButton
              action={cancelTransfer}
              fields={{ id: transfer.id }}
              label={t("transfer.action.cancel")}
              variant="ghost"
              icon="x"
              confirm={t("transfer.cancel.plannedConfirm")}
              className="!px-2 !py-1.5 !text-xs"
            />
          </>
        )}
        {transfer.status === "sent" && (
          <>
            <ActionButton
              action={confirmTransfer}
              fields={{ id: transfer.id }}
              label={t("transfer.action.confirm")}
              pendingLabel={t("common.saving")}
              variant="primary"
              icon="check"
              explain
              className="!px-2.5 !py-1.5 !text-xs"
            />
            <ActionButton
              action={cancelTransfer}
              fields={{ id: transfer.id }}
              label={t("transfer.action.cancel")}
              variant="ghost"
              icon="x"
              confirm={t("transfer.cancel.sentConfirm")}
              className="!px-2 !py-1.5 !text-xs"
            />
          </>
        )}
        {transfer.status === "confirmed" && (
          <span className="inline-flex items-center gap-1 font-mono text-label-sm text-success">
            <Icon name="shield" className="h-3.5 w-3.5" />
            {t("transfer.atomic")}
          </span>
        )}
        {transfer.status === "cancelled" && (
          <Link href="/matcher" className="text-xs text-on-surface-variant hover:text-primary">
            {t("transfer.new")}
          </Link>
        )}
      </div>
    </div>
  );
}
