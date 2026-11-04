"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

export function ActionForm({
  action,
  children,
  submitLabel,
  submitIcon = "check",
  className = "",
  resetOnSuccess = false,
  compact = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  submitIcon?: "check" | "plus" | "shield";
  className?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const response = await action(formData);
          setResult(response);
          if (response.ok && resetOnSuccess) form.reset();
        });
      }}
    >
      {children}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-2" : "mt-3"}`}>
        <button type="submit" className={compact ? "btn-secondary !py-1.5 !text-xs" : "btn-primary"} disabled={pending}>
          <Icon name={pending ? "repeat" : submitIcon} className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? t("common.saving") : submitLabel}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-success" : "text-rose-300"}`}>
            {t(result.key, result.params)}
          </span>
        )}
      </div>
    </form>
  );
}
