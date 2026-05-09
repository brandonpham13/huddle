import { useMemo } from "react";
import {
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
} from "../../../hooks/useSleeper";
import { useDashboardData } from "../useDashboardData";
import { MatchupResult, SectionHead, teamAvatar, teamName } from "../_shared";

export default function ScoreboardWidget() {
  const { selectedLeagueId, week } = useDashboardData();
  const { data: rostersData } = useLeagueRosters(selectedLeagueId);
  const { data: usersData } = useLeagueUsers(selectedLeagueId);
  const { data: matchups } = useLeagueMatchups(selectedLeagueId, week);
  const rosters = rostersData ?? [];
  const users = usersData ?? [];

  const pairs = useMemo(() => {
    type M = NonNullable<typeof matchups>[number];
    const byMatchup = new Map<number, M[]>();
    for (const m of matchups ?? []) {
      if (!m.matchupId) continue;
      const list = byMatchup.get(m.matchupId) ?? [];
      list.push(m);
      byMatchup.set(m.matchupId, list);
    }
    const result: { a: M; b: M }[] = [];
    for (const pair of byMatchup.values()) {
      const first = pair[0];
      const second = pair[1];
      if (first && second) result.push({ a: first, b: second });
    }
    return result;
  }, [matchups]);

  return (
    <section>
      <SectionHead
        kicker={`Week ${week} · Final`}
        title="The Scoreboard"
        rule="All games"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {pairs.map(({ a, b }, i) => {
          const rA = rosters.find((r) => r.rosterId === a.rosterId)!;
          const rB = rosters.find((r) => r.rosterId === b.rosterId)!;
          const aWon = a.points > b.points;
          return (
            <div key={i} className="py-1.5 border-b border-dotted border-line">
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
