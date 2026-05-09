import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../../components/Avatar";
import {
  useSortedRows,
  type SortableColumn,
} from "../../../components/sortable";
import { useLeagueRosters, useLeagueUsers } from "../../../hooks/useSleeper";
import { useDashboardData } from "../useDashboardData";
import { SectionHead, SortHeader, teamAvatar, teamName } from "../_shared";
import type { Roster } from "../../../types/fantasy";

const LEAGUE_TABLE_GRID = "grid-cols-[18px_1fr_52px_52px_52px_44px]";

export default function LeagueTableWidget() {
  const { selectedLeagueId, myRosterId } = useDashboardData();
  const { data: rostersData } = useLeagueRosters(selectedLeagueId);
  const { data: usersData } = useLeagueUsers(selectedLeagueId);
  const rosters = rostersData ?? [];
  const users = usersData ?? [];

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
      { id: "pts", sortValue: (r) => r.pointsFor, defaultDir: "desc" },
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
          id="pts"
          label="Pts"
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
            <div className="text-right font-mono text-[11px] text-body">
              {pf.toFixed(0)}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
