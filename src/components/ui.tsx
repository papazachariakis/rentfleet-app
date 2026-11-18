import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import type { ComponentType } from "react";

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  title?: string;
}) {
  const tones = {
    neutral: "bg-slate-100/80 text-foreground ring-1 ring-inset ring-border/60",
    success: "bg-emerald-50 text-success ring-1 ring-inset ring-emerald-100",
    warning: "bg-amber-50 text-warning ring-1 ring-inset ring-amber-100",
    danger: "bg-red-50 text-danger ring-1 ring-inset ring-red-100",
    accent: "bg-accent-soft text-accent ring-1 ring-inset ring-accent/15",
  };
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export const buttonVariants = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-dark disabled:opacity-50",
  secondary:
    "bg-surface text-foreground border border-border shadow-sm hover:bg-slate-50",
  ghost: "bg-transparent text-muted hover:text-foreground hover:bg-slate-100/80",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

export const buttonSizes = {
  sm: "rounded-lg px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2.5 text-sm",
} as const;

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-colors",
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

export function Card({
  children,
  className,
  elevated = false,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: "none" | "sm" | "md";
}) {
  const paddings = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-surface",
        elevated ? "shadow-md" : "shadow-sm",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Card elevated className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="flex items-center gap-2 text-muted">
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function DataTable({
  children,
  className,
  minWidth = "720px",
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-border/70 bg-surface shadow-sm",
        className
      )}
    >
      <table
        className="w-full text-left text-sm"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-slate-50/80 text-[11px] uppercase tracking-wide text-muted">
      {children}
    </thead>
  );
}

export function Th({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-3 font-medium", className)} {...props}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border/80">{children}</tbody>;
}

export function Td({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3", className)} {...props}>
      {children}
    </td>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
