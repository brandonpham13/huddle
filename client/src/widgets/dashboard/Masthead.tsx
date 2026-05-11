/**
 * Masthead — the newspaper-style title block beneath the Ticker.
 *
 * Three columns on `sm+`:
 *   [VOL. N · ESTABLISHED YYYY]   [LEAGUE NAME (huge serif)]   [Date · Week N]
 *
 * On mobile (`<sm`) the three pieces stack and the "VOL." eyebrow hides
 * to save vertical space (the date row already conveys the week).
 *
 * Wiring: `oldestYear` and `week` come from `DashboardPage`'s display-week
 * derivation; `leagueName` is the selected league's display name.
 */
export function Masthead({
  leagueName,
  week,
  oldestYear,
}: {
  leagueName: string;
  week: number;
  oldestYear: string | null;
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="px-3 sm:px-7 py-3 border-b-2 border-ink">
      <div className="flex flex-col items-center sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-0">
        <div className="hidden sm:block text-[11px] text-muted tracking-wide font-sans">
          VOL. {now.getFullYear() - Number(oldestYear) + 1} · ESTABLISHED{" "}
          {oldestYear}
        </div>
        <div className="flex flex-col items-center min-w-0 max-w-full">
          <div className="font-serif font-bold italic text-3xl sm:text-6xl leading-[0.95] tracking-tight text-ink mt-4 text-center break-words max-w-full">
            {leagueName}
          </div>
          <div className="mt-1 font-serif italic text-[13px] text-muted text-center">
            [PLATFORM] [# OF TEAMS] [FORMAT]
          </div>
        </div>
        <div className="text-[11px] text-muted tracking-wide font-sans text-center sm:text-right">
          {dateStr.toUpperCase()} · WEEK {week}
        </div>
      </div>
    </div>
  );
}
