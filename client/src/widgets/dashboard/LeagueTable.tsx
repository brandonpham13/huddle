import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { useSortedRows, type SortableColumn } from "../../components/sortable";
import type { Roster, TeamUser } from "../../types/fantasy";
import { SectionHead, SortHeader, teamAvatar, teamName } from "./_shared";

// Narrower fixed columns on mobile so the team column has room to breathe;
// expand to comfortable widths at sm+. Six columns: #, Team, W–L, PF, PA, Strk.
const LEAGUE_TABLE_GRID =
  "grid-cols-[16px_1fr_42px_42px_42px_36px] sm:grid-cols-[18px_1fr_52px_52px_52px_44px]";

/**
 * Parse a provider streak string ("3W" / "2L") into a signed integer where
 * positive = win streak, negative = loss streak, 0 = no/unknown streak.
 * Lets us sort the column with a single numeric comparator (descending puts
 * the hottest team at the top, the coldest at the bottom).
 */
function streakSortValue(streak: string | null): number {
  if (!streak) return 0;
  const match = streak.match(/^(\d+)([WL])$/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return match[2].toUpperCase() === "W" ? n : -n;
}

export function LeagueTable({
  rosters,
  users,
  myRosterId,
}: {
  rosters: Roster[];
  users: TeamUser[];
  myRosterId: number | null;
}) {
  // Canonical W–L rank, computed once and used for the leftmost "#" column
  // regardless of the active sort.
  const rankByRosterId = useMemo(() => {
    const sorted = [...rosters].sort((a, b) => {
      const aw = a.record.wins ?? 0;
      const bw = b.record.wins ?? 0;
      if (bw !== aw) return bw - aw;
      return b.pointsFor - a.pointsFor;
    });
    return new Map(sorted.map((r, i) => [r.rosterId, i + 1]));
  }, [rosters]);

  const sortColumns = useMemo<SortableColumn<Roster>[]>(
    () => [
      {
        id: "rank",
        sortValue: (r) => rankByRosterId.get(r.rosterId) ?? Infinity,
        defaultDir: "asc",
      },
      {
        id: "team",
        sortValue: (r) => teamName(r, users).toLowerCase(),
        defaultDir: "asc",
      },
      {
        id: "wl",
        sortValue: (r) => (r.record.wins ?? 0) + (r.record.ties ?? 0) * 0.5,
        defaultDir: "desc",
      },
      { id: "pf", sortValue: (r) => r.pointsFor, defaultDir: "desc" },
      { id: "pa", sortValue: (r) => r.pointsAgainst, defaultDir: "asc" },
      {
        id: "strk",
        // Desc puts the longest win streak at the top, longest loss streak
        // at the bottom — matches what "who's hot" means at a glance.
        sortValue: (r) => streakSortValue(r.streak),
        defaultDir: "desc",
      },
    ],
    [rankByRosterId, users],
  );

  const { sortedRows, sortId, sortDir, handleSort } = useSortedRows(
    rosters,
    sortColumns,
    "rank",
    "asc",
  );

  return (
    <section>
      <SectionHead
        kicker="The Standings"
        title="League Table"
        rule="W–L · PF · PA"
      />
      <div
        className={`grid ${LEAGUE_TABLE_GRID} text-[9.5px] font-semibold tracking-wider uppercase text-muted font-sans border-b border-line pb-1 mb-0.5`}
      >
        <SortHeader
          id="rank"
          label="#"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
        />
        <SortHeader
          id="team"
          label="Team"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
        />
        <SortHeader
          id="wl"
          label="W–L"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
          align="right"
        />
        <SortHeader
          id="pf"
          label="PF"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
          align="right"
        />
        <SortHeader
          id="pa"
          label="PA"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
          align="right"
        />
        <SortHeader
          id="strk"
          label="Strk"
          currentId={sortId}
          dir={sortDir}
          onSort={handleSort}
          align="right"
        />
      </div>
      {sortedRows.map((r) => {
        const isMine = r.rosterId === myRosterId;
        const name = teamName(r, users);
        const avatar = teamAvatar(r, users);
        const w = r.record.wins ?? 0;
        const l = r.record.losses ?? 0;
        const pf = r.pointsFor;
        const pa = r.pointsAgainst;
        const rank = rankByRosterId.get(r.rosterId) ?? "—";
        return (
          <Link
            key={r.rosterId}
            to={`/teams/${r.rosterId}`}
            className={`grid ${LEAGUE_TABLE_GRID} items-center py-[5px] border-b border-dotted border-line hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
              isMine ? "bg-highlight -mx-2 px-2" : ""
            }`}
          >
            <div className="font-serif italic font-semibold text-[13px] text-muted">
              {rank}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar avatar={avatar} name={name} size={16} />
              <span
                className={`font-serif text-[12.5px] truncate ${
                  isMine ? "font-bold text-ink" : "font-medium text-ink"
                }`}
              >
                {name}
              </span>
              {isMine && (
                <span className="text-[8.5px] font-bold uppercase tracking-wider text-accent font-sans shrink-0">
                  You
                </span>
              )}
            </div>
            <div className="text-right font-mono text-[11px] text-body">
              {w}–{l}
            </div>
            <div className="text-right font-mono text-[11px] text-body">
              {pf.toFixed(1)}
            </div>
            <div className="text-right font-mono text-[11px] text-muted">
              {pa.toFixed(1)}
            </div>
            <div className="text-right">
              <StreakBadge streak={r.streak} />
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/**
 * Colored W#/L# streak badge.
 *
 * Reads the Sleeper-supplied streak string ("3W" / "2L") and renders the
 * count + direction with a tint that matches the result:
 *   - Wins → green (`text-emerald-600`, slightly brighter in dark mode)
 *   - Losses → red  (`text-red-600`)
 *   - Unknown / no streak → muted em-dash so the row keeps its alignment
 *
 * We don't add a background — the column is narrow (36/44px) and a tint on
 * the text is enough contrast to skim. The em-dash branch fires when the
 * provider hasn't reported a streak (pre-draft / drafting leagues), or
 * when the value is malformed.
 */
function StreakBadge({ streak }: { streak: string | null }) {
  const match = streak?.match(/^(\d+)([WL])$/i);
  if (!match) {
    return <span className="font-mono text-[11px] text-muted">—</span>;
  }
  const count = match[1];
  const isWin = match[2].toUpperCase() === "W";
  return (
    <span
      className={`font-mono text-[11px] font-semibold tabular-nums ${
        isWin
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {isWin ? "W" : "L"}
      {count}
    </span>
  );
}
