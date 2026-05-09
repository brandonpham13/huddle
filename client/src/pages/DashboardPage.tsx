import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import {
  useAllSleeperLeagues,
  useLeague,
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
  useNFLState,
  useNFLPlayers,
  usePlayerStats,
} from "../hooks/useSleeper";
import { usePowerRankings } from "../hooks/usePowerRankings";
import { getFamilySeasons } from "../utils/leagueFamily";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import type { Roster, TeamUser } from "../types/fantasy";
import type { PowerRankingRow } from "../hooks/usePowerRankings";

// ---------- helpers ----------

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function teamName(roster: Roster, users: TeamUser[]): string {
  const user = roster.ownerId
    ? users.find((u) => u.userId === roster.ownerId)
    : null;
  return user?.teamName ?? user?.displayName ?? `Team ${roster.rosterId}`;
}

function teamAvatar(roster: Roster, users: TeamUser[]): string | null {
  const user = roster.ownerId
    ? users.find((u) => u.userId === roster.ownerId)
    : null;
  return user?.avatar ?? null;
}

function Avatar({
  avatar,
  name,
  size = 20,
}: {
  avatar: string | null;
  name: string;
  size?: number;
}) {
  if (avatar) {
    return (
      <img
        src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold shrink-0 font-serif"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-accent font-sans">
      {children}
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  rule,
}: {
  kicker: string;
  title: string;
  rule: string;
}) {
  return (
    <div className="border-t-2 border-ink pt-1.5 mb-3">
      <div className="flex items-baseline justify-between">
        <div>
          <Eyebrow>{kicker}</Eyebrow>
          <h2 className="font-serif font-bold italic text-xl text-ink leading-tight mt-0.5">
            {title}
          </h2>
        </div>
        <span className="font-serif italic text-xs text-muted">{rule}</span>
      </div>
    </div>
  );
}

// ---------- Ticker ----------

function Ticker({
  matchups,
  rosters,
  users,
  week,
}: {
  matchups: ReturnType<typeof useLeagueMatchups>["data"];
  rosters: Roster[];
  users: TeamUser[];
  week: number;
}) {
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

  const items = [...pairs, ...pairs]; // duplicate for seamless loop

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

// ---------- My Team feature ----------

function MyTeamSection({
  myRosterId,
  rosters,
  users,
  matchups,
  nextMatchups,
  week,
  nextWeek,
  powerRows,
}: {
  myRosterId: number | null;
  rosters: Roster[];
  users: TeamUser[];
  matchups: ReturnType<typeof useLeagueMatchups>["data"];
  nextMatchups: ReturnType<typeof useLeagueMatchups>["data"];
  week: number;
  nextWeek: number;
  powerRows: PowerRankingRow[];
}) {
  const myRoster = rosters.find((r) => r.rosterId === myRosterId);
  if (!myRosterId || !myRoster) {
    return (
      <div className="border-t-2 border-ink pt-3 pb-4">
        <Eyebrow>Your Team</Eyebrow>
        <p className="font-serif italic text-muted text-sm mt-1">
          No claimed team in this league.{" "}
          <Link to="/leagues" className="text-accent hover:underline">
            Join a huddle
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  const me = myRoster;
  const myName = teamName(me, users);
  const myAvatar = teamAvatar(me, users);
  const myUser = me.ownerId ? users.find((u) => u.userId === me.ownerId) : null;
  const myRecord = [me.record.wins ?? 0, me.record.losses ?? 0] as [
    number,
    number,
  ];
  const myPf = me.pointsFor;
  const myPa = me.pointsAgainst;
  const myRank =
    powerRows.find((r) => r.rosterId === myRosterId)?.overallRank ?? null;

  // Current week matchup
  const byMatchup = new Map<number, typeof matchups>();
  for (const m of matchups ?? []) {
    if (!m.matchupId) continue;
    const list = byMatchup.get(m.matchupId) ?? [];
    list.push(m);
    byMatchup.set(m.matchupId, list);
  }
  const myMatchupEntry = (matchups ?? []).find(
    (m) => m.rosterId === myRosterId,
  );
  const myMatchupId = myMatchupEntry?.matchupId ?? null;
  const myMatchupPair = myMatchupId ? (byMatchup.get(myMatchupId) ?? []) : [];
  const oppEntry = myMatchupPair.find((m) => m.rosterId !== myRosterId);
  const oppRoster = oppEntry
    ? rosters.find((r) => r.rosterId === oppEntry.rosterId)
    : null;
  const myPts = myMatchupEntry?.points ?? 0;
  const oppPts = oppEntry?.points ?? 0;
  const won = myPts > oppPts;

  // Next week matchup
  const nextByMatchup = new Map<number, typeof nextMatchups>();
  for (const m of nextMatchups ?? []) {
    if (!m.matchupId) continue;
    const list = nextByMatchup.get(m.matchupId) ?? [];
    list.push(m);
    nextByMatchup.set(m.matchupId, list);
  }
  const myNextEntry = (nextMatchups ?? []).find(
    (m) => m.rosterId === myRosterId,
  );
  const myNextMatchupId = myNextEntry?.matchupId ?? null;
  const myNextPair = myNextMatchupId
    ? (nextByMatchup.get(myNextMatchupId) ?? [])
    : [];
  const nextOppEntry = myNextPair.find((m) => m.rosterId !== myRosterId);
  const nextOppRoster = nextOppEntry
    ? rosters.find((r) => r.rosterId === nextOppEntry.rosterId)
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-6 border-t-2 border-ink pt-3 pb-4">
      <article>
        <Eyebrow>★ Lead · Your Team</Eyebrow>
        <h1 className="font-serif font-bold text-3xl text-ink leading-[1.05] mt-1 mb-2 tracking-tight">
          {myName} sit {myRank ? ordinal(myRank) : "—"} in the power table
          {won ? ", keep winning." : "."}
        </h1>
        <p className="font-serif italic text-xs text-muted mb-3">
          {myRecord[0]}–{myRecord[1]} record · +{(myPf - myPa).toFixed(1)} point
          differential
        </p>

        <div className="flex gap-5 py-2.5 border-t border-b border-line">
          <Stat label="Record" value={`${myRecord[0]}-${myRecord[1]}`} />
          <Stat label="Points For" value={myPf.toFixed(1)} />
          <Stat label="Points Against" value={myPa.toFixed(1)} />
          {myRank && <Stat label="Power Rank" value={ordinal(myRank)} accent />}
        </div>

        <p className="font-serif text-[13.5px] leading-relaxed text-body mt-3 sm:columns-2 gap-5">
          With a {myRecord[0]}–{myRecord[1]} record, <strong>{myName}</strong>{" "}
          heads into week {nextWeek} ranked {myRank ? ordinal(myRank) : "—"} in
          the power standings.{" "}
          {oppRoster
            ? `Week ${week}'s matchup against ${teamName(oppRoster, users)} ended ${won ? "in a win" : "in a loss"} — ${myPts.toFixed(1)} to ${oppPts.toFixed(1)}.`
            : ""}{" "}
          {nextOppRoster
            ? `Next up: ${teamName(nextOppRoster, users)} in week ${nextWeek}.`
            : ""}
        </p>
      </article>

      <aside className="sm:border-l sm:border-line sm:pl-5 border-t border-line pt-3 sm:pt-0 sm:border-t-0">
        <Eyebrow>Week {week} · Result</Eyebrow>
        {oppRoster ? (
          <>
            <MatchupResult
              name={myName}
              avatar={myAvatar}
              pts={myPts}
              won={won}
              big
            />
            <div className="h-1" />
            <MatchupResult
              name={teamName(oppRoster, users)}
              avatar={teamAvatar(oppRoster, users)}
              pts={oppPts}
              won={!won}
              big
            />
            <p className="font-serif italic text-[11px] text-muted mt-1">
              Final · Margin {Math.abs(myPts - oppPts).toFixed(1)}
            </p>
          </>
        ) : (
          <p className="font-serif italic text-sm text-muted mt-2">
            No matchup data
          </p>
        )}

        <div className="h-3 border-t border-line mt-3 pt-3">
          <Eyebrow>Next · Week {nextWeek} Preview</Eyebrow>
          {nextOppRoster ? (
            <div className="mt-1">
              <p className="font-serif font-semibold text-base text-ink">
                vs. {teamName(nextOppRoster, users)}
              </p>
            </div>
          ) : (
            <p className="font-serif italic text-xs text-muted mt-1">
              Schedule TBD
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.16em] uppercase text-muted font-sans">
        {label}
      </div>
      <div
        className={`font-serif font-semibold tabular-nums leading-none mt-0.5 ${
          small ? "text-lg" : "text-2xl"
        } ${accent ? "text-accent" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function MatchupResult({
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
        className={`flex-1 font-serif truncate ${
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
        {pts.toFixed(1)}
      </span>
    </div>
  );
}

// ---------- Top Performers ----------

function TopPerformers({
  rosters,
  users,
  playerStats,
  players,
  week,
}: {
  rosters: Roster[];
  users: TeamUser[];
  playerStats: Record<string, Record<string, number>> | undefined;
  players:
    | Record<
        string,
        {
          fullName?: string;
          firstName: string;
          lastName: string;
          position: string;
        }
      >
    | undefined;
  week: number;
}) {
  const top = useMemo(() => {
    if (!playerStats || !players) return [];

    // Build a map of playerId -> rosterId
    const playerToRoster = new Map<string, number>();
    for (const r of rosters) {
      for (const pid of r.players ?? []) {
        playerToRoster.set(pid, r.rosterId);
      }
    }

    return Object.entries(playerStats)
      .filter(([pid]) => !pid.startsWith("TEAM_") && playerToRoster.has(pid))
      .map(([pid, stats]) => ({
        playerId: pid,
        name:
          players[pid]?.fullName ??
          (`${players[pid]?.firstName ?? ""} ${players[pid]?.lastName ?? ""}`.trim() ||
            pid),
        position: players[pid]?.position ?? "—",
        pts: Number(stats.pts_ppr ?? 0),
        rosterId: playerToRoster.get(pid)!,
      }))
      .filter((p) => p.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 5);
  }, [playerStats, players, rosters]);

  if (top.length === 0) return null;

  return (
    <section>
      <SectionHead
        kicker={`Week ${week} · Stars`}
        title="Top Performers"
        rule="Highest fantasy scorers"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-line">
        {top.map((p, i) => {
          const roster = rosters.find((r) => r.rosterId === p.rosterId)!;
          const tName = teamName(roster, users);
          const tAvatar = teamAvatar(roster, users);
          return (
            <div key={i} className="px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Avatar avatar={tAvatar} name={tName} size={12} />
                <span className="text-[9px] font-semibold tracking-wider uppercase text-muted font-sans truncate">
                  {tName}
                </span>
              </div>
              <div className="font-serif font-bold text-[15px] text-ink leading-tight">
                {p.name}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-lg text-accent tabular-nums">
                  {p.pts.toFixed(1)}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted font-sans">
                  {p.position} · pts
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- League Table ----------

function LeagueTable({
  rosters,
  users,
  myRosterId,
}: {
  rosters: Roster[];
  users: TeamUser[];
  myRosterId: number | null;
}) {
  const sorted = useMemo(
    () =>
      [...rosters].sort((a, b) => {
        const aw = a.record.wins ?? 0;
        const bw = b.record.wins ?? 0;
        if (bw !== aw) return bw - aw;
        const apf = a.pointsFor;
        const bpf = b.pointsFor;
        return bpf - apf;
      }),
    [rosters],
  );

  return (
    <section>
      <SectionHead
        kicker="The Standings"
        title="League Table"
        rule="W–L · PF · PA"
      />
      <div className="grid grid-cols-[18px_1fr_52px_52px_52px_44px] text-[9.5px] font-semibold tracking-wider uppercase text-muted font-sans border-b border-line pb-1 mb-0.5">
        <div>#</div>
        <div>Team</div>
        <div className="text-right">W–L</div>
        <div className="text-right">PF</div>
        <div className="text-right">PA</div>
        <div className="text-right">Pts</div>
      </div>
      {sorted.map((r, i) => {
        const isMine = r.rosterId === myRosterId;
        const name = teamName(r, users);
        const avatar = teamAvatar(r, users);
        const w = r.record.wins ?? 0;
        const l = r.record.losses ?? 0;
        const pf = r.pointsFor;
        const pa = r.pointsAgainst;
        return (
          <Link
            key={r.rosterId}
            to={`/teams/${r.rosterId}`}
            className={`grid grid-cols-[18px_1fr_52px_52px_52px_44px] items-center py-[5px] border-b border-dotted border-line hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
              isMine ? "bg-highlight -mx-2 px-2" : ""
            }`}
          >
            <div className="font-serif italic font-semibold text-[13px] text-muted">
              {i + 1}
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

// ---------- Scoreboard ----------

function Scoreboard({
  rosters,
  users,
  matchups,
  week,
}: {
  rosters: Roster[];
  users: TeamUser[];
  matchups: ReturnType<typeof useLeagueMatchups>["data"];
  week: number;
}) {
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

// ---------- Power Rankings ----------

function PowerRankings({ rows }: { rows: PowerRankingRow[] }) {
  return (
    <section>
      <SectionHead
        kicker="Editorial Index"
        title="Power Rankings"
        rule="Composite · this week"
      />
      <div>
        {rows.map((row) => {
          const score = row.scores[Object.keys(row.scores)[0] ?? ""] ?? 0;
          return (
            <Link
              key={row.rosterId}
              to={`/teams/${row.rosterId}`}
              className="grid grid-cols-[18px_1fr_40px] items-center gap-1.5 py-1 border-b border-dotted border-line hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="font-serif italic font-semibold text-xs text-muted">
                {row.overallRank}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar avatar={row.avatar} name={row.teamName} size={14} />
                <span className="font-serif text-[12.5px] text-ink truncate">
                  {row.teamName}
                </span>
              </div>
              <div className="text-right font-mono text-[10.5px] text-body">
                {score != null ? Number(score).toFixed(2) : "—"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Masthead ----------

function Masthead({ leagueName, week }: { leagueName: string; week: number }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="px-3 sm:px-7 py-3 border-b-2 border-ink">
      <div className="flex flex-col items-center sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-0">
        <div className="hidden sm:block text-[10px] text-muted tracking-wide font-sans">
          {leagueName.toUpperCase()}
        </div>
        <div className="font-serif font-bold italic text-3xl sm:text-5xl leading-[0.95] tracking-tight text-ink">
          The Huddle
        </div>
        <div className="text-[10px] text-muted tracking-wide font-sans text-center sm:text-right">
          {dateStr.toUpperCase()} · WEEK {week}
        </div>
      </div>
    </div>
  );
}

// ---------- Season selector ----------

function SeasonBar({
  selectedLeague,
  familySeasons,
  myRosterId,
  claimedTeamName,
  claimedAvatar,
}: {
  selectedLeague: ReturnType<typeof useLeague>["data"];
  familySeasons: ReturnType<typeof useLeague>["data"][];
  myRosterId: number | null;
  claimedTeamName: string | null;
  claimedAvatar: string | null;
}) {
  const dispatch = useAppDispatch();
  if (!selectedLeague) return null;
  return (
    <div className="px-3 sm:px-7 py-2 border-b border-line bg-chrome flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] text-muted tracking-wider uppercase min-w-0">
        <span className="font-serif italic text-ink text-xl sm:text-2xl font-bold tracking-tight normal-case shrink-0">
          Huddle
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">Home</span>
        <span className="hidden sm:inline">·</span>
        <span className="truncate">{selectedLeague.name}</span>
        {familySeasons.length > 1 && (
          <>
            <span>·</span>
            <select
              value={selectedLeague.season}
              onChange={(e) => {
                const entry = familySeasons.find(
                  (l) => l?.season === e.target.value,
                );
                if (entry) {
                  dispatch(setSelectedLeague(entry.ref.leagueId));
                  dispatch(setSelectedYear(entry.season));
                }
              }}
              className="bg-transparent border-none outline-none text-[10px] font-mono text-muted tracking-wider uppercase cursor-pointer"
            >
              {familySeasons.map((l) =>
                l ? (
                  <option key={l.ref.leagueId} value={l.season}>
                    {l.season}
                  </option>
                ) : null,
              )}
            </select>
          </>
        )}
      </div>
      {claimedTeamName && (
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-accent tracking-wider uppercase font-semibold">
          <Avatar avatar={claimedAvatar} name={claimedTeamName} size={16} />★{" "}
          {claimedTeamName}
        </div>
      )}
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center font-serif italic text-muted text-lg">
        <Link to="/leagues" className="text-accent hover:underline">
          Sync a league
        </Link>{" "}
        to get started.
      </div>
    </div>
  );
}

// ---------- Main DashboardPage ----------

export function DashboardPage() {
  const syncedLeagueIds = useAppSelector(
    (state) => state.auth.user?.syncedLeagueIds ?? [],
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

  const { data: allLeagues } = useAllSleeperLeagues();
  const { data: selectedLeague } = useLeague(selectedLeagueId);
  const { data: nflState } = useNFLState();
  const { data: players } = useNFLPlayers();

  const week = nflState?.display_week ?? nflState?.week ?? 1;
  const season = nflState?.season ?? selectedLeague?.season ?? "2024";
  const nextWeek = week < 18 ? week + 1 : week;

  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: users } = useLeagueUsers(selectedLeagueId);
  const { data: matchups } = useLeagueMatchups(selectedLeagueId, week);
  const { data: nextMatchups } = useLeagueMatchups(
    selectedLeagueId,
    nextWeek !== week ? nextWeek : 0,
  );
  const { data: playerStats } = usePlayerStats(season, week);
  const { data: powerData } = usePowerRankings(selectedLeagueId);

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );
  const currentFamilyLeagueId =
    familySeasons[0]?.ref.leagueId ?? selectedLeagueId;
  const {
    teamName: claimedTeamName,
    avatar: claimedAvatar,
    rosterId: myRosterId,
  } = useMyClaimedTeam(currentFamilyLeagueId);

  const syncedLeagues =
    allLeagues?.filter((l) => syncedLeagueIds.includes(l.ref.leagueId)) ?? [];

  const hasLeague = !!selectedLeagueId && syncedLeagues.length > 0;

  return (
    <div className="min-h-full bg-paper text-ink font-sans flex flex-col">
      {!hasLeague ? (
        <EmptyState />
      ) : (
        <>
          <SeasonBar
            selectedLeague={selectedLeague}
            familySeasons={familySeasons}
            myRosterId={myRosterId}
            claimedTeamName={claimedTeamName}
            claimedAvatar={claimedAvatar}
          />

          <Ticker
            matchups={matchups}
            rosters={rosters ?? []}
            users={users ?? []}
            week={week}
          />

          <Masthead leagueName={selectedLeague?.name ?? ""} week={week} />

          <div className="px-3 sm:px-7 pt-4 pb-6 flex-1">
            <MyTeamSection
              myRosterId={myRosterId}
              rosters={rosters ?? []}
              users={users ?? []}
              matchups={matchups}
              nextMatchups={nextMatchups}
              week={week}
              nextWeek={nextWeek}
              powerRows={powerData?.rows ?? []}
            />

            <div className="h-4" />

            <TopPerformers
              rosters={rosters ?? []}
              users={users ?? []}
              playerStats={
                playerStats as
                  | Record<string, Record<string, number>>
                  | undefined
              }
              players={players}
              week={week}
            />

            <div className="h-4" />

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.9fr] gap-6">
              <LeagueTable
                rosters={rosters ?? []}
                users={users ?? []}
                myRosterId={myRosterId}
              />
              <Scoreboard
                rosters={rosters ?? []}
                users={users ?? []}
                matchups={matchups}
                week={week}
              />
              <PowerRankings rows={powerData?.rows ?? []} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
