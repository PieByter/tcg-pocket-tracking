import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="label-xs flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-headline-lg text-on-surface lg:text-headline-xl">{title}</h1>
        {description && <p className="mt-2 text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const toneClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-rose-300",
  success: "text-success",
} as const;

export function StatCard({
  label,
  value,
  hint,
  detail,
  tone = "primary",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  detail?: ReactNode;
  tone?: keyof typeof toneClasses;
  icon?: IconName;
}) {
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="label-xs">{label}</p>
        {icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 ${toneClasses[tone]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`mt-2 font-display text-3xl font-bold leading-none ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-on-surface">{hint}</p>}
      {detail && <div className="mt-3 border-t border-white/[0.07] pt-2 text-xs text-on-surface-variant">{detail}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 font-display text-headline-md text-on-surface">
          <span className="h-2 w-2 rounded-full bg-secondary" />
          {title}
          {badge && <span className="ml-1 font-mono text-label-sm uppercase tracking-wider text-outline">{badge}</span>}
        </h2>
        {subtitle && <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = "package",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-outline">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-display text-base text-on-surface">{title}</p>
      {description && <p className="max-w-md text-body-sm text-on-surface-variant">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
