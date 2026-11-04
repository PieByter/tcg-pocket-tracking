import Link from "next/link";
import { deleteAccount, saveAccount, saveSettings } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { PageHeader, SectionHeading } from "@/components/ui";
import { catalogCardCount, loadLedger } from "@/lib/queries";

export const metadata = { title: "Settings & Rules — PocketLedger" };

export default async function SettingsPage() {
  const [ledger, catalogCount] = await Promise.all([loadLedger(), catalogCardCount()]);
  const { accounts, settings } = ledger;
  const usesSupabase = Boolean(process.env.DATABASE_URL);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konfigurasi ledger · batas harian & akun"
        title="Settings & Rules"
        description="Semua batas permainan disimpan sebagai konfigurasi, bukan hardcode. Ubah di sini ketika aturan game berubah."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel p-3">
          <p className="label-xs">Database</p>
          <p className="mt-1 flex items-center gap-2 font-display text-sm text-on-surface">
            <Icon name="package" className="h-4 w-4 text-primary" />
            {usesSupabase ? "Supabase Postgres (pooler)" : "PGlite lokal (.data)"}
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {catalogCount.toLocaleString("id-ID")} kartu di katalog · {accounts.length} akun
          </p>
        </div>
        <div className="panel p-3">
          <p className="label-xs">Zona waktu reset</p>
          <p className="mt-1 font-mono text-sm text-primary">{settings.timeZone}</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Reset pukul {String(settings.resetHour).padStart(2, "0")}:00 · hari aktif {ledger.today}
          </p>
        </div>
        <div className="panel p-3">
          <p className="label-xs">Perhitungan ex</p>
          <p className="mt-1 font-display text-sm text-on-surface">
            {settings.exCountMode === "name" ? "Unik per nama kartu" : "Unik per cetakan"}
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Alt-art dari kartu yang sama tidak menambah jumlah ex pada mode nama.
          </p>
        </div>
      </div>

      <section>
        <SectionHeading
          title="Akun"
          subtitle="min_ex dipakai untuk menentukan defisit ex per akun."
          badge={`${accounts.length} akun`}
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
                  label="Hapus"
                  variant="ghost"
                  icon="x"
                  confirm={`Hapus ${account.name}? Holdings ikut terhapus, riwayat transfer memblokir penghapusan.`}
                  className="!px-2 !py-1 !text-xs text-rose-200"
                />
              </div>

              <ActionForm action={saveAccount} submitLabel="Simpan akun" className="mt-2" compact>
                <input type="hidden" name="id" value={account.id} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs text-on-surface-variant">
                    Nama akun
                    <input name="name" defaultValue={account.name} className="field mt-1" required maxLength={60} />
                  </label>
                  <label className="text-xs text-on-surface-variant">
                    Friend code
                    <input
                      name="friendCode"
                      defaultValue={account.friendCode ?? ""}
                      placeholder="1234-5678-9012"
                      className="field mt-1 font-mono"
                      maxLength={30}
                    />
                  </label>
                  <label className="text-xs text-on-surface-variant">
                    Minimal ex unik
                    <input
                      name="minEx"
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={account.minEx}
                      className="field mt-1 font-mono"
                    />
                  </label>
                  <label className="text-xs text-on-surface-variant">
                    Catatan
                    <input
                      name="notes"
                      defaultValue={account.notes ?? ""}
                      placeholder="opsional"
                      className="field mt-1"
                      maxLength={280}
                    />
                  </label>
                </div>
              </ActionForm>
            </div>
          ))}

          <div className="panel-raised p-3">
            <p className="flex items-center gap-2 font-display text-sm text-on-surface">
              <Icon name="plus" className="h-4 w-4 text-primary" />
              Tambah akun
            </p>
            <ActionForm action={saveAccount} submitLabel="Tambah akun" submitIcon="plus" resetOnSuccess>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-on-surface-variant">
                  Nama akun
                  <input name="name" className="field mt-1" placeholder="Akun 9: …" required maxLength={60} />
                </label>
                <label className="text-xs text-on-surface-variant">
                  Friend code
                  <input name="friendCode" className="field mt-1 font-mono" placeholder="1234-5678-9012" maxLength={30} />
                </label>
                <label className="text-xs text-on-surface-variant">
                  Minimal ex unik
                  <input name="minEx" type="number" min={0} max={20} defaultValue={2} className="field mt-1 font-mono" />
                </label>
                <label className="text-xs text-on-surface-variant">
                  Catatan
                  <input name="notes" className="field mt-1" placeholder="opsional" maxLength={280} />
                </label>
              </div>
            </ActionForm>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          title="Aturan harian & planner"
          subtitle="Dipakai untuk menegakkan kuota di server saat transfer ditandai terkirim atau dikonfirmasi."
        />
        <div className="panel p-4">
          <ActionForm action={saveSettings} submitLabel="Simpan aturan" submitIcon="shield">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <NumberField
                name="shareReceivePerDay"
                label="Share · terima per akun / hari"
                defaultValue={settings.shareReceivePerDay}
                min={1}
                max={5}
                hint="Aturan game v1: 1"
              />
              <NumberField
                name="shareSendPerPairPerDay"
                label="Share · kirim per pasangan / hari"
                defaultValue={settings.shareSendPerPairPerDay}
                min={1}
                max={5}
                hint="Aturan game v1: 1"
              />
              <NumberField
                name="tradePerAccountPerDay"
                label="Trade · per akun / hari"
                defaultValue={settings.tradePerAccountPerDay}
                min={1}
                max={20}
                hint="Belum terverifikasi; default 5"
              />
              <NumberField
                name="tradePairCooldownDays"
                label="Trade · cooldown pasangan (hari)"
                defaultValue={settings.tradePairCooldownDays}
                min={0}
                max={30}
                hint="1 = tidak boleh dua kali di hari yang sama"
              />
              <NumberField
                name="resetHour"
                label="Jam reset harian (0–23)"
                defaultValue={settings.resetHour}
                min={0}
                max={23}
                hint="Dipakai untuk menghitung game day"
              />
              <label className="text-xs text-on-surface-variant">
                Zona waktu reset
                <input name="timeZone" defaultValue={settings.timeZone} className="field mt-1 font-mono" />
              </label>
              <NumberField
                name="exTarget"
                label="Target default kartu ex"
                defaultValue={settings.exTarget}
                min={0}
                max={10}
              />
              <NumberField
                name="trainerTarget"
                label="Target default trainer"
                defaultValue={settings.trainerTarget}
                min={0}
                max={10}
              />
              <NumberField
                name="plannerHorizonDays"
                label="Horizon planner (hari)"
                defaultValue={settings.plannerHorizonDays}
                min={1}
                max={60}
              />
              <label className="text-xs text-on-surface-variant">
                Perhitungan ex unik
                <select name="exCountMode" defaultValue={settings.exCountMode} className="field mt-1">
                  <option value="name">Per nama kartu (alt-art tidak menambah)</option>
                  <option value="print">Per cetakan (tiap alt-art dihitung)</option>
                </select>
              </label>
            </div>
          </ActionForm>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(settings.tradeCosts).map(([code, cost]) => (
              <div key={code} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
                <p className="font-mono text-label-sm uppercase tracking-wider text-outline">Rarity {code}</p>
                <p className="font-mono text-sm text-secondary">
                  {Number(cost).toLocaleString("id-ID")} shinedust
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            Biaya Shinedust hanya ditampilkan sebagai informasi di kandidat Trade; tidak memengaruhi kuota.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading title="Operasional" subtitle="Seed katalog dan cara memperbarui data." />
        <div className="panel space-y-2 p-4 text-body-sm text-on-surface-variant">
          <p className="flex items-start gap-2">
            <Icon name="package" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Perbarui katalog saat set baru rilis: <code className="font-mono text-primary">npm run catalog:build</code>{" "}
              lalu <code className="font-mono text-primary">npm run db:seed</code>. Kepemilikan yang sudah ada tidak
              berubah.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              Aplikasi tidak menyimpan kredensial game. Password ledger berasal dari{" "}
              <code className="font-mono text-primary">APP_PASSWORD</code>; sesi ditandatangani{" "}
              <code className="font-mono text-primary">AUTH_SECRET</code>.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Icon name="swap" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>
              Transfer antar akun sendiri tetap perlu mengikuti ToS Pokémon TCG Pocket. Aplikasi ini hanya pencatat.
            </span>
          </p>
          <Link href="/transfers" className="btn-secondary mt-1 w-fit">
            Buka riwayat transfer
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
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
