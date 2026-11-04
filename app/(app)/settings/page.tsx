import Link from "next/link";
import { deleteAccount, saveAccount, saveSettings } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { PageHeader, SectionHeading } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { catalogCardCount, loadLedger } from "@/lib/queries";
import type { Translate } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("settings.metaTitle") };
}

export default async function SettingsPage() {
  const [[ledger, catalogCount], { locale, t }] = await Promise.all([
    Promise.all([loadLedger(), catalogCardCount()]),
    getI18n(),
  ]);
  const { accounts, settings } = ledger;
  const usesSupabase = Boolean(process.env.DATABASE_URL);
  const resetTime = `${String(settings.resetHour).padStart(2, "0")}:00`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel p-3">
          <p className="label-xs">{t("settings.db.label")}</p>
          <p className="mt-1 flex items-center gap-2 font-display text-sm text-on-surface">
            <Icon name="package" className="h-4 w-4 text-primary" />
            {usesSupabase ? t("settings.db.supabase") : t("settings.db.local")}
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {t("settings.db.detail", {
              cards: formatNumber(catalogCount, locale),
              accounts: accounts.length,
            })}
          </p>
        </div>
        <div className="panel p-3">
          <p className="label-xs">{t("settings.tz.label")}</p>
          <p className="mt-1 font-mono text-sm text-primary">{settings.timeZone}</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {t("settings.tz.detail", { time: resetTime, day: ledger.today })}
          </p>
        </div>
        <div className="panel p-3">
          <p className="label-xs">{t("settings.exmode.label")}</p>
          <p className="mt-1 font-display text-sm text-on-surface">
            {t(settings.exCountMode === "name" ? "settings.exmode.name" : "settings.exmode.print")}
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">{t("settings.exmode.detail")}</p>
        </div>
      </div>

      <section>
        <SectionHeading
          title={t("settings.accounts.title")}
          subtitle={t("settings.accounts.subtitle")}
          badge={t("settings.accounts.badge", { count: accounts.length })}
        />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className="panel p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-display text-sm text-on-surface">
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-primary/25 bg-primary/10 font-mono text-label-sm text-primary">
                    {String(account.sortOrder + 1).padStart(2, "0")}
                  </span>
                  {account.name}
                </p>
                <ActionButton
                  action={deleteAccount}
                  fields={{ id: account.id }}
                  label={t("settings.accounts.delete")}
                  variant="ghost"
                  icon="x"
                  confirm={t("settings.accounts.deleteConfirm", { account: account.name })}
                  className="!px-2 !py-1 !text-xs text-rose-200"
                />
              </div>

              <ActionForm action={saveAccount} submitLabel={t("settings.accounts.save")} className="mt-2" compact>
                <input type="hidden" name="id" value={account.id} />
                <AccountFields
                  t={t}
                  name={account.name}
                  friendCode={account.friendCode ?? ""}
                  minEx={account.minEx}
                  notes={account.notes ?? ""}
                  stamina={account.tradeStamina}
                  shinedust={account.shinedust}
                />
              </ActionForm>
            </div>
          ))}

          <div className="panel-raised p-3">
            <p className="flex items-center gap-2 font-display text-sm text-on-surface">
              <Icon name="plus" className="h-4 w-4 text-primary" />
              {t("settings.accounts.add.title")}
            </p>
            <ActionForm
              action={saveAccount}
              submitLabel={t("settings.accounts.add.submit")}
              submitIcon="plus"
              resetOnSuccess
            >
              <AccountFields
                t={t}
                name=""
                friendCode=""
                minEx={2}
                notes=""
                stamina={0}
                shinedust={0}
                placeholder
              />
            </ActionForm>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title={t("settings.rules.title")} subtitle={t("settings.rules.subtitle")} />
        <div className="panel p-4">
          <ActionForm action={saveSettings} submitLabel={t("settings.rules.save")} submitIcon="shield">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <NumberField
                name="shareReceivePerDay"
                label={t("settings.rules.shareReceive")}
                defaultValue={settings.shareReceivePerDay}
                min={1}
                max={5}
                hint={t("settings.rules.shareReceiveHint")}
              />
              <NumberField
                name="shareSendPerPairPerDay"
                label={t("settings.rules.sharePair")}
                defaultValue={settings.shareSendPerPairPerDay}
                min={1}
                max={5}
                hint={t("settings.rules.sharePairHint")}
              />
              <NumberField
                name="tradePerAccountPerDay"
                label={t("settings.rules.trade")}
                defaultValue={settings.tradePerAccountPerDay}
                min={1}
                max={20}
                hint={t("settings.rules.tradeHint")}
              />
              <NumberField
                name="tradePairCooldownDays"
                label={t("settings.rules.cooldown")}
                defaultValue={settings.tradePairCooldownDays}
                min={0}
                max={30}
                hint={t("settings.rules.cooldownHint")}
              />
              <NumberField
                name="resetHour"
                label={t("settings.rules.resetHour")}
                defaultValue={settings.resetHour}
                min={0}
                max={23}
                hint={t("settings.rules.resetHourHint")}
              />
              <label className="text-xs text-on-surface-variant">
                {t("settings.rules.timeZone")}
                <input name="timeZone" defaultValue={settings.timeZone} className="field mt-1 font-mono" />
              </label>
              <NumberField
                name="exTarget"
                label={t("settings.rules.exTarget")}
                defaultValue={settings.exTarget}
                min={0}
                max={10}
              />
              <NumberField
                name="trainerTarget"
                label={t("settings.rules.trainerTarget")}
                defaultValue={settings.trainerTarget}
                min={0}
                max={10}
              />
              <NumberField
                name="plannerHorizonDays"
                label={t("settings.rules.horizon")}
                defaultValue={settings.plannerHorizonDays}
                min={1}
                max={60}
              />
              <NumberField
                name="tradeStaminaRegenHours"
                label={t("settings.rules.staminaRegen")}
                defaultValue={settings.tradeStaminaRegenHours}
                min={1}
                max={168}
                hint={t("settings.rules.staminaRegenHint")}
              />
              <NumberField
                name="maxTradeStamina"
                label={t("settings.rules.maxStamina")}
                defaultValue={settings.maxTradeStamina}
                min={1}
                max={99}
                hint={t("settings.rules.maxStaminaHint")}
              />
              <label className="text-xs text-on-surface-variant">
                {t("settings.rules.exMode")}
                <select name="exCountMode" defaultValue={settings.exCountMode} className="field mt-1">
                  <option value="name">{t("settings.rules.exModeName")}</option>
                  <option value="print">{t("settings.rules.exModePrint")}</option>
                </select>
              </label>
            </div>
          </ActionForm>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(settings.tradeCosts).map(([code, cost]) => (
              <div key={code} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
                <p className="font-mono text-label-sm uppercase tracking-wider text-outline">
                  {code}
                </p>
                <p className="font-mono text-sm text-secondary">
                  {formatNumber(Number(cost), locale)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-body-sm text-on-surface-variant">{t("settings.rules.costs")}</p>
        </div>
      </section>

      <section>
        <SectionHeading title={t("settings.ops.title")} subtitle={t("settings.ops.subtitle")} />
        <div className="panel space-y-2 p-4 text-body-sm text-on-surface-variant">
          <p className="flex items-start gap-2">
            <Icon name="package" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{t("settings.ops.catalog")}</span>
          </p>
          <p className="flex items-start gap-2">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>{t("settings.ops.security")}</span>
          </p>
          <p className="flex items-start gap-2">
            <Icon name="swap" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>{t("settings.ops.tos")}</span>
          </p>
          <Link href="/transfers" className="btn-secondary mt-1 w-fit">
            {t("settings.ops.history")}
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function AccountFields({
  t,
  name,
  friendCode,
  minEx,
  notes,
  stamina,
  shinedust,
  placeholder = false,
}: {
  t: Translate;
  name: string;
  friendCode: string;
  minEx: number;
  notes: string;
  stamina: number;
  shinedust: number;
  placeholder?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.name")}
          <input
            name="name"
            defaultValue={name}
            placeholder={placeholder ? t("settings.accounts.namePlaceholder") : undefined}
            className="field mt-1"
            required
            maxLength={60}
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.friendCode")}
          <input
            name="friendCode"
            defaultValue={friendCode}
            placeholder="1234-5678-9012"
            className="field mt-1 font-mono"
            maxLength={30}
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.minEx")}
          <input
            name="minEx"
            type="number"
            min={0}
            max={20}
            defaultValue={minEx}
            className="field mt-1 font-mono"
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.notes")}
          <input
            name="notes"
            defaultValue={notes}
            placeholder={t("common.optional")}
            className="field mt-1"
            maxLength={280}
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.stamina")}
          <input
            name="tradeStamina"
            type="number"
            min={0}
            max={99}
            defaultValue={stamina}
            className="field mt-1 font-mono"
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          {t("settings.accounts.field.shinedust")}
          <input
            name="shinedust"
            type="number"
            min={0}
            max={9999999}
            step={100}
            defaultValue={shinedust}
            className="field mt-1 font-mono"
          />
        </label>
      </div>
      <p className="mt-1 text-[10px] text-outline">{t("settings.accounts.field.resourcesHint")}</p>
    </>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <label className="text-xs text-on-surface-variant">
      {label}
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="field mt-1 font-mono"
      />
      {hint && <span className="mt-0.5 block text-[10px] text-outline">{hint}</span>}
    </label>
  );
}
