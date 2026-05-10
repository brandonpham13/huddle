import { Avatar } from "../../components/Avatar";
import { type SortDir } from "../../components/sortable";
import type { Roster, TeamUser } from "../../types/fantasy";

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function teamName(roster: Roster, users: TeamUser[]): string {
  const user = roster.ownerId
    ? users.find((u) => u.userId === roster.ownerId)
    : null;
  return user?.teamName ?? user?.displayName ?? `Team ${roster.rosterId}`;
}

export function teamAvatar(roster: Roster, users: TeamUser[]): string | null {
  const user = roster.ownerId
    ? users.find((u) => u.userId === roster.ownerId)
    : null;
  return user?.avatar ?? null;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-accent font-sans">
      {children}
    </div>
  );
}

export function SectionHead({
  kicker,
  title,
  rule,
}: {
  kicker: string;
  title: string;
  rule: React.ReactNode;
}) {
  return (
    <div className="border-t-2 border-ink pt-1.5 mb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <Eyebrow>{kicker}</Eyebrow>
          <h2 className="font-serif font-bold italic text-xl text-ink leading-tight mt-0.5">
            {title}
          </h2>
        </div>
        {typeof rule === "string" ? (
          <span className="font-serif italic text-xs text-muted shrink-0">
            {rule}
          </span>
        ) : (
          rule
        )}
      </div>
    </div>
  );
}

export function SortHeader({
  id,
  label,
  currentId,
  dir,
  onSort,
  align = "left",
  sortable = true,
  className = "",
}: {
  id: string;
  label: string;
  currentId: string | null;
  dir: SortDir;
  onSort: (id: string) => void;
  align?: "left" | "right";
  sortable?: boolean;
  className?: string;
}) {
  const isSorted = currentId === id;
  if (!sortable) {
    return (
      <div className={`${align === "right" ? "text-right" : ""} ${className}`}>
        {label}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSort(id)}
      className={`w-full flex items-center gap-0.5 cursor-pointer hover:text-ink transition-colors ${
        align === "right" ? "justify-end" : "justify-start"
      } ${isSorted ? "text-ink" : ""} ${className}`}
    >
      <span>{label}</span>
      <span
        className={`text-[8px] leading-none ${isSorted ? "" : "opacity-30"}`}
        aria-hidden="true"
      >
        {isSorted ? (dir === "asc" ? "▲" : "▼") : "▼"}
      </span>
    </button>
  );
}

export function MatchupResult({
  name,
  avatar,
  pts,
  won,
  big,
}: {
  name: string;
  avatar: string | null;
  pts: number;
  won: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <Avatar avatar={avatar} name={name} size={big ? 24 : 18} />
      <span
        className={`flex-1 font-serif truncate leading-none translate-y-px ${
          won ? "font-bold text-ink" : "font-medium text-body"
        } ${big ? "text-[15px]" : "text-[13px]"}`}
      >
        {name}
      </span>
      <span
        className={`font-serif tabular-nums ${
          won ? "font-bold text-ink" : "font-medium text-body"
        } ${big ? "text-[19px]" : "text-sm"}`}
      >
        {pts.toFixed(2)}
      </span>
    </div>
  );
}
