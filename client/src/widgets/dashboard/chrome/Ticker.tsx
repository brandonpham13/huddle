import { Avatar } from "../../../components/Avatar";
import {
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
} from "../../../hooks/useSleeper";
import { useDashboardData } from "../useDashboardData";
import type { Roster, TeamUser } from "../../../types/fantasy";

export function Ticker() {
  const { selectedLeagueId, week } = useDashboardData();
  const { data: rostersData } = useLeagueRosters(selectedLeagueId);
  const { data: usersData } = useLeagueUsers(selectedLeagueId);
  const { data: matchups } = useLeagueMatchups(selectedLeagueId, week);

  const rosters = rostersData ?? [];
  const users = usersData ?? [];

  if (!matchups || matchups.length === 0) return null;

  const pairs: {
    home: Roster;
    away: Roster;
    homeUser: TeamUser | null;
    awayUser: TeamUser | null;
    homePts: number;
    awayPts: number;
  }[] = [];

  const byMatchup = new Map<number, typeof matchups>();
  for (const m of matchups) {
    if (!m.matchupId) continue;
    const list = byMatchup.get(m.matchupId) ?? [];
    list.push(m);
    byMatchup.set(m.matchupId, list);
  }

  for (const [, pair] of byMatchup) {
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    const rA = rosters.find((r) => r.rosterId === a.rosterId);
    const rB = rosters.find((r) => r.rosterId === b.rosterId);
    if (!rA || !rB) continue;
    pairs.push({
      home: rA,
      away: rB,
      homeUser: rA.ownerId
        ? (users.find((u) => u.userId === rA.ownerId) ?? null)
        : null,
      awayUser: rB.ownerId
        ? (users.find((u) => u.userId === rB.ownerId) ?? null)
        : null,
      homePts: a.points,
      awayPts: b.points,
    });
  }

  const items = [...pairs, ...pairs];

  return (
    <div className="relative overflow-hidden bg-chrome border-b border-line">
      <style>{`@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div
        style={{ animation: "ticker 60s linear infinite" }}
        className="inline-flex whitespace-nowrap py-2.5"
      >
        {items.map((m, i) => {
          const homeWon = m.homePts > m.awayPts;
          const hName =
            m.homeUser?.teamName ??
            m.homeUser?.displayName ??
            `Team ${m.home.rosterId}`;
          const aName =
            m.awayUser?.teamName ??
            m.awayUser?.displayName ??
            `Team ${m.away.rosterId}`;
          return (
            <div
              key={i}
              className="inline-flex items-center gap-3 px-5 border-r border-line"
            >
              <span className="font-mono text-[10px] text-muted tracking-wider">
                W{week.toString().padStart(2, "0")}
              </span>
              <TickerTeam
                name={hName}
                pts={m.homePts}
                won={homeWon}
                avatar={m.homeUser?.avatar ?? null}
              />
              <span className="font-serif italic text-sm text-muted">vs</span>
              <TickerTeam
                name={aName}
                pts={m.awayPts}
                won={!homeWon}
                avatar={m.awayUser?.avatar ?? null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickerTeam({
  name,
  pts,
  won,
  avatar,
}: {
  name: string;
  pts: number;
  won: boolean;
  avatar: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar avatar={avatar} name={name} size={16} />
      <span
        className={`font-serif text-sm ${won ? "font-bold italic text-ink" : "font-medium text-body"}`}
      >
        {name}
      </span>
      <span
        className={`font-mono text-xs tabular-nums ${won ? "font-bold text-accent" : "text-muted"}`}
      >
        {pts.toFixed(1)}
      </span>
    </span>
  );
}
