/**
 * Shared presentational atoms for the Schedule Generator widgets — mirrors
 * `widgets/dashboard/_shared.tsx`'s role for the dashboard: one place to
 * keep the panel/button chrome consistent across
 * TeamRosterPanel / ScheduleOptionsPanel / LockedMatchupsPanel / GeneratedScheduleGrid.
 */
import type { ReactNode } from "react";

/** Formats 1 → "1st", 2 → "2nd", 3 → "3rd", ... */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line rounded-lg p-5 flex flex-col gap-4 bg-paper">
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  subtitle,
}: {
  title: string;
  description?: string;
  /** Small muted caption next to the title — for a fixed fact about the
   *  panel (e.g. a hard limit) that shouldn't compete with `description`. */
  subtitle?: string;
}) {
  return (
    <div className="border-b border-line pb-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">
          {title}
        </h2>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-wide text-muted font-sans">
            {subtitle}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-[12.5px] text-muted font-sans leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  danger,
  variant = "default",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  variant?: "default" | "primary";
  type?: "button" | "submit";
}) {
  if (variant === "primary") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium font-sans transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${
          danger
            ? "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            : "border-line text-ink hover:bg-highlight"
        }`}
    >
      {children}
    </button>
  );
}
