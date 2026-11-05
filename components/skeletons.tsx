import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function SkeletonScreen({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonPageHeader({ actions = 2 }: { actions?: number }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2">
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="mt-3 h-8 w-64 max-w-full sm:h-10" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className="h-9 w-32" />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkeletonSectionHeading({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="w-full max-w-md">
        <Skeleton className="h-6 w-52 max-w-full" />
        <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-6 w-36" />}
    </div>
  );
}

export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <div className={`panel p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-8 w-14" />
      <Skeleton className="mt-2 h-3.5 w-28" />
      <Skeleton className="mt-4 h-3 w-36 max-w-full" />
    </div>
  );
}

export function SkeletonStatGrid({
  count = 4,
  className = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonStatCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonField({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function SkeletonList({
  rows = 5,
  className = "",
  withThumb = true,
}: {
  rows?: number;
  className?: string;
  withThumb?: boolean;
}) {
  return (
    <div className={`panel divide-y divide-white/[0.06] overflow-hidden ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          {withThumb && <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDayPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-12 rounded" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="divide-y divide-white/[0.06]">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
