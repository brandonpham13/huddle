import { useEffect, useMemo, useState } from "react";
import { useLeagueMatchups, useWinnersBracket } from "../../hooks/useSleeper";
import type { Roster, TeamUser } from "../../types/fantasy";
import { MatchupResult, SectionHead, teamAvatar, teamName } from "./_shared";

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

type MatchupTag =
  | "regular"
  | "playoff"
  | "championship"
  | "3rd_place"
  | "consolation";

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
  const [viewWeek, setViewWeek] = useState(currentWeek);

  useEffect(() => {
    setViewWeek(currentWeek);
  }, [currentWeek]);

  const { data: matchups, isLoading } = useLeagueMatchups(leagueId, viewWeek);
  const { data: winnersBracket } = useWinnersBracket(leagueId);

  const isPlayoffWeek = !!(playoffWeekStart && viewWeek >= playoffWeekStart);
  const playoffRound = isPlayoffWeek ? viewWeek - playoffWeekStart! + 1 : 0;
  const maxBracketRound = useMemo(
    () =>
      winnersBracket ? Math.max(0, ...winnersBracket.map((m) => m.round)) : 0,
    [winnersBracket],
  );
  const isFinalRound = playoffRound > 0 && playoffRound === maxBracketRound;

  // Trace the bracket tree to classify each playoff matchup.
  // Semifinal matchup_ids (penultimate round, main path) let us identify:
  //   Championship  — both teams are winner_of a semifinal
  //   3rd place     — either team is loser_of a semifinal
  //   Other placement — everything else in the final round (5th place, etc.)
  //   Playoff       — any bracket matchup in an earlier round
  //   Consolation   — not in the bracket at all
  const bracketTagByRosterKey = useMemo(() => {
    const map = new Map<string, MatchupTag>();
    if (!winnersBracket || !isPlayoffWeek) return map;

    const semiFinalIds = new Set(
      winnersBracket
        .filter(
          (bm) =>
            bm.round === maxBracketRound - 1 &&
            bm.team1_from?.loser_of == null &&
            bm.team2_from?.loser_of == null,
        )
        .map((bm) => bm.matchup_id),
    );

    for (const bm of winnersBracket) {
      if (bm.round !== playoffRound) continue;
      const r1 = bm.team1_roster_id;
      const r2 = bm.team2_roster_id;
      if (r1 == null || r2 == null) continue;

      const key = [r1, r2].sort((a, b) => a - b).join("-");

      if (isFinalRound) {
        const isChampionship =
          semiFinalIds.has(bm.team1_from?.winner_of!) &&
          semiFinalIds.has(bm.team2_from?.winner_of!);
        const is3rdPlace =
          semiFinalIds.has(bm.team1_from?.loser_of!) ||
          semiFinalIds.has(bm.team2_from?.loser_of!);

        if (isChampionship) map.set(key, "championship");
        else if (is3rdPlace) map.set(key, "3rd_place");
        else map.set(key, "consolation");
      } else {
        map.set(key, "playoff");
      }
    }
    return map;
  }, [
    winnersBracket,
    isPlayoffWeek,
    playoffRound,
    isFinalRound,
    maxBracketRound,
  ]);

  const pairs = useMemo(() => {
    type M = NonNullable<typeof matchups>[number];
    const byMatchup = new Map<number, M[]>();
    for (const m of matchups ?? []) {
      if (!m.matchupId) continue;
      const list = byMatchup.get(m.matchupId) ?? [];
      list.push(m);
      byMatchup.set(m.matchupId, list);
    }
    const result: { a: M; b: M; tag: MatchupTag }[] = [];
    for (const pair of byMatchup.values()) {
      const first = pair[0];
      const second = pair[1];
      if (!first || !second) continue;

      let tag: MatchupTag = "regular";
      if (isPlayoffWeek) {
        const key = [first.rosterId, second.rosterId]
          .sort((a, b) => a - b)
          .join("-");
        tag = bracketTagByRosterKey.get(key) ?? "consolation";
      }
      result.push({ a: first, b: second, tag });
    }
    if (isPlayoffWeek) {
      const order: Record<MatchupTag, number> = {
        championship: 0,
        "3rd_place": 1,
        playoff: 2,
        consolation: 3,
        regular: 4,
      };
      result.sort((x, y) => order[x.tag] - order[y.tag]);
    }
    return result;
  }, [matchups, isPlayoffWeek, bracketTagByRosterKey]);

  const canPrev = viewWeek > 1;
  const canNext = viewWeek < lastWeek;
  const label = weekLabel(viewWeek, playoffWeekStart, lastWeek);

  const navButtons = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => setViewWeek((w) => w - 1)}
        className="px-1.5 py-0.5 text-xs font-serif font-semibold rounded border border-line enabled:hover:bg-ink/5 disabled:opacity-25 transition-colors"
        aria-label="Previous week"
      >
        ◀
      </button>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => setViewWeek((w) => w + 1)}
        className="px-1.5 py-0.5 text-xs font-serif font-semibold rounded border border-line enabled:hover:bg-ink/5 disabled:opacity-25 transition-colors"
        aria-label="Next week"
      >
        ▶
      </button>
    </div>
  );

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

          const highlight =
            tag === "championship"
              ? "border-l-2 border-l-amber-500 pl-2"
              : tag === "playoff"
                ? "border-l-2 border-l-accent pl-2"
                : tag === "3rd_place"
                  ? "border-l-2 border-l-muted pl-2"
                  : "";

          const tagLabel: Record<
            MatchupTag,
            { text: string; cls: string } | null
          > = {
            championship: { text: "Championship", cls: "text-amber-600" },
            "3rd_place": { text: "3rd Place Game", cls: "text-muted" },
            playoff: { text: "Playoff", cls: "text-accent" },
            consolation: { text: "Consolation", cls: "text-muted" },
            regular: null,
          };
          const badge = tagLabel[tag];

          return (
            <div
              key={i}
              className={`py-1.5 border-b border-dotted border-line ${highlight}`}
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
