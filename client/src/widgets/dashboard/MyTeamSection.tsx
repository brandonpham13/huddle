import { Link } from "react-router-dom";
import { useLeagueMatchups } from "../../hooks/useSleeper";
import type { Roster, TeamUser } from "../../types/fantasy";
import type { PowerRankingRow } from "../../hooks/usePowerRankings";
import {
  Eyebrow,
  MatchupResult,
  ordinal,
  teamAvatar,
  teamName,
} from "./_shared";

export function MyTeamSection({
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
      <div>
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
  const myRecord = [me.record.wins ?? 0, me.record.losses ?? 0] as [
    number,
    number,
  ];
  const myPf = me.pointsFor;
  const myPa = me.pointsAgainst;
  const myRank =
    powerRows.find((r) => r.rosterId === myRosterId)?.overallRank ?? null;

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
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-6 pt-1 pb-1">
      <article>
        <Eyebrow>★ Lead · Your Team</Eyebrow>
        <h1 className="font-serif font-bold text-3xl text-ink leading-[1.05] mt-2 mb-2 tracking-tight">
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

        <p className="font-serif text-[13.5px] leading-relaxed text-body mt-2 sm:columns-2 gap-5">
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
