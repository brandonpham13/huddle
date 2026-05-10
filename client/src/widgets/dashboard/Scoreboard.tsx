import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useLeagueMatchups,
  useLosersBracket,
  useWinnersBracket,
} from "../../hooks/useSleeper";
import type { PlayoffMatchup, Roster, TeamUser } from "../../types/fantasy";
import { MatchupResult, SectionHead, teamAvatar, teamName } from "./_shared";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type MatchupTag =
  | "regular"
  | "playoff"
  | "championship"
  | "3rd_place"
  | "consolation";

/** Display order when sorting matchups during playoff weeks. */
const TAG_ORDER: Record<MatchupTag, number> = {
  championship: 0,
  "3rd_place": 1,
  playoff: 2,
  consolation: 3,
  regular: 4,
};

/** Badge text & color for each tag (null = no badge). */
const TAG_BADGE: Record<MatchupTag, { text: string; cls: string } | null> = {
  championship: { text: "Championship", cls: "text-amber-600" },
  "3rd_place": { text: "3rd Place Game", cls: "text-muted" },
  playoff: { text: "Playoff", cls: "text-accent" },
  consolation: { text: "Consolation", cls: "text-muted" },
  regular: null,
};

/** Left-border accent for each tag (empty string = no highlight). */
const TAG_HIGHLIGHT: Record<MatchupTag, string> = {
  championship: "border-l-2 border-l-amber-500 pl-2",
  playoff: "border-l-2 border-l-accent pl-2",
  "3rd_place": "border-l-2 border-l-muted pl-2",
  consolation: "",
  regular: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weekLabel(
  week: number,
  playoffStart: number | null,
  lastWeek: number,
): string {
  if (playoffStart && week >= playoffStart) {
    if (week === lastWeek) return `Week ${week} · Championship`;
    return `Week ${week} · Playoffs`;
  }
  return `Week ${week} · Final`;
}

/** Sorted roster-pair key used to match bracket entries to weekly matchups. */
function rosterKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Collect every unique roster ID that appears in a bracket. */
function collectRosterIds(bracket: PlayoffMatchup[]): Set<number> {
  const ids = new Set<number>();
  for (const bm of bracket) {
    if (bm.team1_roster_id != null) ids.add(bm.team1_roster_id);
    if (bm.team2_roster_id != null) ids.add(bm.team2_roster_id);
  }
  return ids;
}

/**
 * Walk the winners bracket backward from the championship (place === 1) along
 * winner_of links to find every matchup ID on the path to the title.
 *
 * Also collects roster IDs from those path matchups so that re-seeding brackets
 * (which lack team_from links on intermediate rounds) can still be classified:
 * if a team from an earlier round later appears in a path matchup, the earlier
 * matchup must have produced a winner for that path.
 */
function buildPlayoffPath(bracket: PlayoffMatchup[]): {
  pathMatchupIds: Set<number>;
  pathRosterIds: Set<number>;
} {
  const byId = new Map(bracket.map((bm) => [bm.matchup_id, bm]));
  const champMatch = bracket.find((bm) => bm.place === 1);

  const pathMatchupIds = new Set<number>();
  if (champMatch) {
    const queue = [champMatch.matchup_id];
    while (queue.length) {
      const id = queue.shift()!;
      if (pathMatchupIds.has(id)) continue;
      pathMatchupIds.add(id);
      const m = byId.get(id);
      if (m?.team1_from?.winner_of != null)
        queue.push(m.team1_from.winner_of);
      if (m?.team2_from?.winner_of != null)
        queue.push(m.team2_from.winner_of);
    }
  }

  const pathRosterIds = new Set<number>();
  for (const id of pathMatchupIds) {
    const m = byId.get(id);
    if (m?.team1_roster_id != null) pathRosterIds.add(m.team1_roster_id);
    if (m?.team2_roster_id != null) pathRosterIds.add(m.team2_roster_id);
  }

  return { pathMatchupIds, pathRosterIds };
}

/**
 * Classify every winners-bracket matchup in the given playoff round.
 *
 * Returns a map keyed by sorted roster-pair ("3-7") → MatchupTag.
 *
 * Classification cascade (first match wins):
 *  1. place === 1                       → championship
 *  2. place === 3                       → 3rd place
 *  3. place > 1                         → consolation (5th, 7th, …)
 *  4. matchup on the BFS path           → playoff
 *  5. either roster in a path matchup   → playoff  (re-seeding fallback)
 *  6. both rosters in winners bracket   → playoff  (unresolved-bracket fallback)
 *  7. otherwise                         → consolation
 */
function classifyBracketRound(
  bracket: PlayoffMatchup[],
  playoffRound: number,
  pathMatchupIds: Set<number>,
  pathRosterIds: Set<number>,
  winnerRosterIds: Set<number>,
): Map<string, MatchupTag> {
  const map = new Map<string, MatchupTag>();

  for (const bm of bracket) {
    if (bm.round !== playoffRound) continue;
    const r1 = bm.team1_roster_id;
    const r2 = bm.team2_roster_id;
    if (r1 == null || r2 == null) continue;

    const key = rosterKey(r1, r2);

    if (bm.place === 1) {
      map.set(key, "championship");
    } else if (bm.place === 3) {
      map.set(key, "3rd_place");
    } else if (bm.place != null && bm.place > 1) {
      map.set(key, "consolation");
    } else if (pathMatchupIds.has(bm.matchup_id)) {
      map.set(key, "playoff");
    } else if (pathRosterIds.size > 0) {
      map.set(
        key,
        pathRosterIds.has(r1) || pathRosterIds.has(r2)
          ? "playoff"
          : "consolation",
      );
    } else {
      map.set(
        key,
        winnerRosterIds.has(r1) && winnerRosterIds.has(r2)
          ? "playoff"
          : "consolation",
      );
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Scoreboard({
  rosters,
  users,
  leagueId,
  currentWeek,
  playoffWeekStart,
  lastWeek,
}: {
  rosters: Roster[];
  users: TeamUser[];
  leagueId: string;
  currentWeek: number;
  playoffWeekStart: number | null;
  lastWeek: number;
}) {
  // ---- Week navigation state ----

  const [viewWeek, setViewWeek] = useState(currentWeek);
  useEffect(() => {
    setViewWeek(currentWeek);
  }, [currentWeek]);

  // ---- Data fetching ----

  const { data: matchups, isLoading } = useLeagueMatchups(leagueId, viewWeek);
  const { data: winnersBracket } = useWinnersBracket(leagueId);
  const { data: losersBracket } = useLosersBracket(leagueId);

  // ---- Derived playoff state ----

  const isPlayoffWeek = !!(playoffWeekStart && viewWeek >= playoffWeekStart);
  const playoffRound = isPlayoffWeek ? viewWeek - playoffWeekStart! + 1 : 0;

  /** All roster IDs that belong to the winners (playoff) bracket. */
  const winnerRosterIds = useMemo(
    () => (winnersBracket ? collectRosterIds(winnersBracket) : new Set<number>()),
    [winnersBracket],
  );

  /** All roster IDs from the losers (non-playoff consolation) bracket. */
  const loserRosterIds = useMemo(
    () => (losersBracket ? collectRosterIds(losersBracket) : new Set<number>()),
    [losersBracket],
  );

  // ---- Bracket classification ----

  /**
   * Map of sorted roster-pair key → MatchupTag for the current playoff round.
   * Used to label each weekly matchup as championship / playoff / consolation.
   */
  const bracketTagByRosterKey = useMemo(() => {
    if (!winnersBracket || !isPlayoffWeek) return new Map<string, MatchupTag>();

    const { pathMatchupIds, pathRosterIds } =
      buildPlayoffPath(winnersBracket);

    return classifyBracketRound(
      winnersBracket,
      playoffRound,
      pathMatchupIds,
      pathRosterIds,
      winnerRosterIds,
    );
  }, [winnersBracket, isPlayoffWeek, playoffRound, winnerRosterIds]);

  // ---- Build matchup pairs ----

  /**
   * Group the weekly matchup data into head-to-head pairs, then tag each pair
   * with its playoff classification. During playoff weeks, pairs are sorted so
   * championship / playoff games appear above consolation.
   */
  const pairs = useMemo(() => {
    type M = NonNullable<typeof matchups>[number];

    // Group raw matchup rows by their shared matchupId.
    const byMatchup = new Map<number, M[]>();
    for (const m of matchups ?? []) {
      if (!m.matchupId) continue;
      const list = byMatchup.get(m.matchupId) ?? [];
      list.push(m);
      byMatchup.set(m.matchupId, list);
    }

    const result: { a: M; b: M; tag: MatchupTag }[] = [];

    for (const pair of byMatchup.values()) {
      const [first, second] = pair;
      if (!first || !second) continue;

      let tag: MatchupTag = "regular";

      if (isPlayoffWeek) {
        const key = rosterKey(first.rosterId, second.rosterId);
        const bracketTag = bracketTagByRosterKey.get(key);

        if (bracketTag) {
          tag = bracketTag;
        } else {
          // Matchup wasn't found in the bracket map — fall back to bracket
          // membership to decide if it's playoff vs consolation.
          const bothInWinners =
            winnerRosterIds.has(first.rosterId) &&
            winnerRosterIds.has(second.rosterId);
          const eitherInLosers =
            loserRosterIds.has(first.rosterId) ||
            loserRosterIds.has(second.rosterId);

          if (bothInWinners) tag = "playoff";
          else if (eitherInLosers) tag = "consolation";
          else tag = "consolation";
        }
      }

      result.push({ a: first, b: second, tag });
    }

    // Sort so the most important games appear first.
    if (isPlayoffWeek) {
      result.sort((x, y) => TAG_ORDER[x.tag] - TAG_ORDER[y.tag]);
    }

    return result;
  }, [matchups, isPlayoffWeek, bracketTagByRosterKey, winnerRosterIds, loserRosterIds]);

  // ---- Navigation ----

  const hasAnyData = lastWeek > 0;
  const canPrev = hasAnyData && viewWeek > 1;
  const canNext = hasAnyData && viewWeek < lastWeek;
  const label = weekLabel(viewWeek, playoffWeekStart, lastWeek);

  const navButtons = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => setViewWeek((w) => w - 1)}
        className="p-1 rounded border border-line enabled:hover:bg-ink/5 disabled:opacity-25 transition-colors"
        aria-label="Previous week"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => setViewWeek((w) => w + 1)}
        className="p-1 rounded border border-line enabled:hover:bg-ink/5 disabled:opacity-25 transition-colors"
        aria-label="Next week"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );

  // ---- Render ----

  return (
    <section>
      <SectionHead kicker={label} title="The Scoreboard" rule={navButtons} />

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-x-5 transition-opacity ${isLoading ? "opacity-40" : ""}`}
      >
        {pairs.length === 0 && !isLoading && (
          <p className="col-span-full text-center text-muted font-serif italic text-sm py-4">
            No matchups for this week.
          </p>
        )}

        {pairs.map(({ a, b, tag }, i) => {
          const rA = rosters.find((r) => r.rosterId === a.rosterId);
          const rB = rosters.find((r) => r.rosterId === b.rosterId);
          if (!rA || !rB) return null;

          const aWon = a.points > b.points;
          const badge = TAG_BADGE[tag];

          return (
            <div
              key={i}
              className={`py-1.5 border-b border-dotted border-line ${TAG_HIGHLIGHT[tag]}`}
            >
              {badge && (
                <span
                  className={`text-[9px] font-sans font-semibold tracking-widest uppercase ${badge.cls}`}
                >
                  {badge.text}
                </span>
              )}
              <MatchupResult
                name={teamName(rA, users)}
                avatar={teamAvatar(rA, users)}
                pts={a.points}
                won={aWon}
              />
              <MatchupResult
                name={teamName(rB, users)}
                avatar={teamAvatar(rB, users)}
                pts={b.points}
                won={!aWon}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
