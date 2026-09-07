"use client";

import { ReactNode } from "react";
import { clsx } from "./clsx";

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-card border border-line bg-card shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "info",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: "info" | "success" | "warning" | "danger" | "purple";
}) {
  const tones = {
    info: "bg-accent-soft text-accent",
    success: "bg-[var(--success-soft)] text-success",
    warning: "bg-[var(--warning-soft)] text-warning",
    danger: "bg-[var(--error-soft)] text-danger",
    purple: "bg-[color-mix(in_srgb,var(--purple)_16%,transparent)] text-[var(--purple)]",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-subtle">{label}</div>
          <div className="mt-1 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
          {hint ? <div className="mt-2 text-xs text-success">{hint}</div> : null}
        </div>
        <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>
      </div>
    </Card>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-subtle">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    outline: "border border-line bg-card text-ink hover:bg-muted",
    ghost: "text-subtle hover:bg-muted",
    danger: "bg-[var(--error-soft)] text-danger hover:bg-danger hover:text-white",
  };
  return (
    <button
      className={clsx("inline-flex h-9 items-center gap-2 rounded-btn px-3 text-sm font-medium", styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "h-9 w-full rounded-input border border-line bg-card px-3 text-sm text-ink placeholder:text-faint outline-none focus:border-accent",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx("h-9 rounded-input border border-line bg-card px-3 text-sm text-ink", props.className)}
    />
  );
}

export function DateRangeSelect({ className }: { className?: string }) {
  return (
    <Select className={clsx("w-40", className)} defaultValue="30d">
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="all">All time</option>
    </Select>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple";
}) {
  const map = {
    success: "bg-[var(--success-soft)] text-success",
    warning: "bg-[var(--warning-soft)] text-warning",
    danger: "bg-[var(--error-soft)] text-danger",
    info: "bg-accent-soft text-accent",
    purple: "bg-[color-mix(in_srgb,var(--purple)_16%,transparent)] text-[var(--purple)]",
    neutral: "bg-muted text-subtle",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", map[tone])}>{children}</span>;
}

export function StatusDot({ tone, label }: { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }) {
  const map = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-faint" };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={clsx("h-1.5 w-1.5 rounded-full", map[tone])} />
      {label}
    </span>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-5 border-b border-line">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={clsx(
            "-mb-px border-b-2 pb-2 text-sm",
            value === item.id ? "border-accent font-medium text-accent" : "border-transparent text-subtle hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined ? <span className="ml-1 text-faint">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, from, to }: { page: number; pages: number; total: number; from: number; to: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-subtle">
      <span>
        Showing {from} to {to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={clsx("h-8 min-w-8 rounded-btn px-2", n === page ? "bg-accent text-white" : "hover:bg-muted")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Banner({ children, tone = "info", className }: { children: ReactNode; tone?: "info" | "warning"; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-card px-4 py-3 text-sm",
        tone === "info" ? "bg-info-soft text-info" : "bg-[var(--warning-soft)] text-warning",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-sm text-subtle">{text}</div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-card border border-line bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
