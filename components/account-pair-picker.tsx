"use client";

import { useRouter } from "next/navigation";
import type { Account } from "@/db/schema";
import { Icon } from "./icon";

export function AccountPairPicker({
  accounts,
  receiverId,
  senderId,
}: {
  accounts: Account[];
  receiverId: string;
  senderId: string;
}) {
  const router = useRouter();

  const navigate = (nextReceiver: string, nextSender: string) => {
    const params = new URLSearchParams({ to: nextReceiver, from: nextSender });
    router.push(`/matcher?${params.toString()}`);
  };

  return (
    <div className="relative z-10 flex flex-col items-stretch justify-between gap-3 xl:flex-row xl:items-center">
      <div className="flex-1 rounded-xl border border-white/[0.07] bg-surface-container-lowest/80 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="label-xs flex items-center gap-1.5 text-secondary">
            <Icon name="arrowDown" className="h-3.5 w-3.5" />
            Akun penerima (defisit)
          </span>
          <span className="chip border-primary/25 bg-primary/10 text-primary">kuota terima</span>
        </div>
        <select
          value={receiverId}
          onChange={(event) => navigate(event.target.value, senderId)}
          className="field mt-2 font-display text-base"
          aria-label="Akun penerima"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-center gap-1 px-2 text-center">
        <div className="hidden h-px w-8 bg-surface-variant xl:block" />
        <button
          type="button"
          onClick={() => navigate(senderId, receiverId)}
          className="grid h-10 w-10 place-items-center rounded-full border border-primary/30 bg-surface-container-high text-primary transition hover:bg-primary/10"
          title="Tukar penerima dan pemberi"
          aria-label="Tukar penerima dan pemberi"
        >
          <Icon name="swap" className="h-5 w-5" />
        </button>
        <span className="font-mono text-label-sm uppercase tracking-[0.16em] text-primary">Transfer matcher</span>
        <span className="max-w-[170px] text-[11px] text-on-surface-variant">Algoritma auto-balance aktif</span>
      </div>

      <div className="flex-1 rounded-xl border border-white/[0.07] bg-surface-container-lowest/80 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="label-xs flex items-center gap-1.5 text-primary">
            <Icon name="arrowUp" className="h-3.5 w-3.5" />
            Akun pemberi (surplus)
          </span>
          <span className="chip border-white/10 bg-white/5 text-on-surface-variant">kuota kirim</span>
        </div>
        <select
          value={senderId}
          onChange={(event) => navigate(receiverId, event.target.value)}
          className="field mt-2 font-display text-base"
          aria-label="Akun pemberi"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
