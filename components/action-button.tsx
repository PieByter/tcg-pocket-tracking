"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "primary",
  icon,
  confirm,
  className = "",
  explain = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: Variant;
  icon?: IconName;
  confirm?: string;
  className?: string;
  explain?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = () => {
    if (confirm && !window.confirm(confirm)) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== "") formData.set(key, value);
    }
    startTransition(async () => {
      setResult(await action(formData));
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`${variants[variant]} ${className}`}
        title={explain && result && !result.ok ? result.message : undefined}
      >
        {icon && <Icon name={pending ? "repeat" : icon} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />}
        {pending ? pendingLabel ?? label : label}
      </button>
      {result && !result.ok && <span className="text-[11px] text-rose-300">{result.message}</span>}
      {result?.ok && explain && <span className="text-[11px] text-success">{result.message}</span>}
    </span>
  );
}
