/**
 * TeamPage — newspaper-style team profile inside AppShell.
 *
 * Four sections (matching the design prototype):
 *   1. Masthead        — team crest, name, owner, season record, streak, power rank
 *   2. Current Season  — season trail sparkline (live) + roster table (stub)
 *   3. Lifetime Stats  — career record shell (stub — data piped in later)
 *   4. Season History  — per-season row table (stub)
 *   5. Trophy Room     — superlative cards (stub — algorithm-assigned later)
 *
 * Stubs are clearly marked and structurally ready to receive real data;
 * they render the correct layout with placeholder values so the page is
 * usable as-is.
 */
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import {
  useAllSleeperLeagues,
  useLeague,
  useLeagueRosters,
  useLeagueUsers,
  useNFLState,
  useTeamSeasonLog,
} from "../hooks/useSleeper";
import { usePowerRankings } from "../hooks/usePowerRankings";
import { useMyClaimedTeam } from "../hooks/useMyClaimedTeam";
import { getFamilySeasons } from "../utils/leagueFamily";
import { sleeperAvatarUrl } from "../utils/sleeperNormalize";
import { Avatar } from "../components/Avatar";

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9.5px] font-semibold tracking-[0.18em] uppercase text-muted font-sans">
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
  rule?: string;
}) {
  return (
    <div className="border-t-2 border-ink pt-1.5 mb-4">
      <Eyebrow>{kicker}</Eyebrow>
      <div className="flex items-baseline justify-between gap-4 mt-0.5">
        <h2 className="font-serif font-bold italic text-xl text-ink leading-tight">
          {title}
        </h2>
        {rule && (
          <span className="font-serif italic text-xs text-muted shrink-0">
            {rule}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  large,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.16em] uppercase text-muted font-sans">
        {label}
      </div>
      <div
        className={`font-serif font-semibold leading-none mt-1 tabular-nums ${
          large ? "text-2xl" : "text-[18px]"
        } ${accent ? "text-accent" : "text-ink"}`}
      >
        {value}
      </div>
      {sub && (
        <div className="font-serif italic text-[10.5px] text-muted mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Stub banner ──────────────────────────────────────────────────────────────

function StubBanner({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-line px-4 py-3 text-[11px] text-muted font-sans italic">
      {label} — data pipeline coming soon
    </div>
  );
}

// ─── Section 1: Masthead ──────────────────────────────────────────────────────

function Masthead({
  teamName,
  ownerName,
  avatar,
  record,
  streak,
  pf,
  pa,
  powerRank,
  season,
  isMyTeam,
}: {
  teamName: string;
  ownerName: string | null;
  avatar: string | null;
  record: { wins: number; losses: number; ties: number };
  streak: string | null;
  pf: number;
  pa: number;
  powerRank: number | null;
  season: string;
  isMyTeam: boolean;
}) {
  const initials = teamName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const wl = `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`;

  return (
    <div className="px-6 pt-5 pb-4 border-b-2 border-ink">
      <div className="flex items-end justify-between gap-6">
        {/* Left: crest + name */}
        <div className="flex items-center gap-5">
          {/* Team crest */}
          <div className="relative shrink-0">
            {sleeperAvatarUrl(avatar) ? (
              <img
                src={sleeperAvatarUrl(avatar)!}
                alt={teamName}
                className="w-20 h-20 rounded object-cover ring-2 ring-accent"
              />
            ) : (
              <div className="w-20 h-20 bg-accent flex items-center justify-center rounded ring-2 ring-accent">
                <span className="font-serif italic font-bold text-4xl text-white leading-none tracking-tight">
                  {initials}
                </span>
              </div>
            )}
          </div>

          <div>
            <Eyebrow>
              {ownerName ? `Manager · ${ownerName} · ` : ""}
              {season} Season
              {isMyTeam && (
                <span className="ml-2 text-accent font-bold">★ Your Team</span>
              )}
            </Eyebrow>
            <h1 className="font-serif font-bold italic text-[42px] leading-[0.96] tracking-tight text-ink mt-1 mb-1">
              {teamName}
            </h1>
            <div className="font-serif italic text-xs text-muted">
              {record.wins + record.losses + (record.ties ?? 0)} games played ·{" "}
              {((record.wins / Math.max(record.wins + record.losses, 1)) * 100).toFixed(0)}% win rate
            </div>
          </div>
        </div>

        {/* Right: key stats */}
        <div className="flex gap-5 shrink-0 text-right">
          <Stat label="Record" value={wl} />
          <Stat label="Streak" value={streak ?? "—"} accent />
          <Stat
            label="Power"
            value={powerRank != null ? `#${powerRank}` : "—"}
          />
          <Stat label="PF" value={pf.toFixed(1)} />
          <Stat label="PA" value={pa.toFixed(1)} />
        </div>
      </div>
    </div>
  );
}

// ─── Section 2: Current Season ────────────────────────────────────────────────

function SeasonTrail({
  log,
}: {
  log: { week: number; pf: number; pa: number; result: "W" | "L" | "T" | null }[];
}) {
  if (log.length === 0) {
    return (
      <div className="text-[11px] text-muted font-sans italic py-2">
        No scored weeks yet.
      </div>
    );
  }

  const allPts = log.flatMap((g) => [g.pf, g.pa]);
  const max = Math.max(...allPts);
  const min = Math.min(...allPts);
  const range = max - min || 1;
  // Scale the canvas width to the number of weeks so spacing stays consistent
  // regardless of how many weeks have been played. 28px per week feels right
  // at both extremes (3 weeks = 84px canvas, 17 weeks = 476px canvas). The
  // SVG stretches to fill its container either way via width="100%".
  const COL = 28;
  const W = Math.max(log.length * COL, COL);
  const H = 80;
  const x = (i: number) => (log.length === 1 ? W / 2 : i * COL);
  const y = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
  const polyline = (key: "pf" | "pa") =>
    log.map((g, i) => `${x(i)},${y(g[key])}`).join(" ");

  return (
    <div>
      <Eyebrow>Season Trail · PF vs PA</Eyebrow>
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        width="100%"
        height="auto"
        className="block mt-1.5"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            className="stroke-line"
            strokeDasharray="2 3"
          />
        ))}
        <polyline
          fill="none"
          className="stroke-muted"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          points={polyline("pa")}
        />
        <polyline
          fill="none"
          className="stroke-accent"
          strokeWidth="2"
          points={polyline("pf")}
        />
        {log.map((g, i) => (
          <g key={g.week}>
            <circle
              cx={x(i)}
              cy={y(g.pf)}
              r={3}
              className={
                g.result === "W" ? "fill-accent" : "fill-loss"
              }
            />
            <text
              x={x(i)}
              y={H + 14}
              fontSize="8"
              className="fill-muted"
              fontFamily="'IBM Plex Mono', monospace"
              textAnchor="middle"
            >
              W{g.week}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 text-[9px] uppercase tracking-wider font-sans text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-accent inline-block" /> Points For
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-muted inline-block" style={{ borderBottom: "1px dashed" }} /> Points Against
        </span>
      </div>
    </div>
  );
}

function CurrentSeason({
  roster,
  log,
  week,
}: {
  roster: import("../types/fantasy").Roster;
  log: ReturnType<typeof useTeamSeasonLog>;
  week: number;
}) {
  const gamesPlayed = log.length;
  const avgPf = gamesPlayed > 0 ? roster.pointsFor / gamesPlayed : 0;
  const margin = roster.pointsFor - roster.pointsAgainst;

  return (
    <section>
      <SectionHead
        kicker={`${new Date().getFullYear()} Season · in progress`}
        title="Current Season"
        rule="Active roster · weekly trail"
      />
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6">
        {/* Left: roster stub */}
        <div>
          <Eyebrow>Starting Lineup · Week {week}</Eyebrow>
          <div className="mt-2">
            <StubBanner label="Projected lineup with per-player stats" />
            <div className="mt-3 grid grid-cols-4 gap-3">
              <Stat label="PF" value={roster.pointsFor.toFixed(1)} />
              <Stat label="PA" value={roster.pointsAgainst.toFixed(1)} />
              <Stat label="Avg PF" value={avgPf.toFixed(1)} accent />
              <Stat
                label="Margin"
                value={`${margin >= 0 ? "+" : ""}${margin.toFixed(1)}`}
              />
            </div>
          </div>
        </div>

        {/* Right: sparkline */}
        <div className="border-l border-line pl-5">
          <SeasonTrail log={log} />
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Lifetime Stats ────────────────────────────────────────────────

function LifetimeStats() {
  return (
    <section>
      <SectionHead
        kicker="All-Time"
        title="Lifetime Statistics"
        rule="Career · all seasons"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Career record pillar */}
        <div>
          <Eyebrow>Career Record</Eyebrow>
          <div className="mt-2">
            <StubBanner label="Career W–L, win %, playoff appearances, championships" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Playoff Apps" value="—" />
            <Stat label="Championships" value="—" accent />
            <Stat label="Runner-Ups" value="—" />
            <Stat label="Avg Finish" value="—" />
          </div>
        </div>

        {/* Scoring pillar */}
        <div className="border-l border-line pl-5">
          <Eyebrow>Scoring</Eyebrow>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Avg PF" value="—" accent />
            <Stat label="Avg PA" value="—" />
          </div>
          <div className="mt-3">
            <Eyebrow>Extremes</Eyebrow>
            <div className="mt-2 space-y-1">
              {[
                { label: "High Score", value: "—", ctx: "— · — · —" },
                { label: "Low Score", value: "—", ctx: "— · — · —" },
                { label: "Biggest Win", value: "—", ctx: "— · — · —" },
                { label: "Worst Loss", value: "—", ctx: "— · — · —" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-baseline py-1 border-b border-dotted border-line"
                >
                  <span className="text-[9.5px] uppercase tracking-wider font-sans text-muted font-semibold">
                    {row.label}
                  </span>
                  <div className="text-right">
                    <div className="font-serif font-semibold text-base text-ink tabular-nums leading-none">
                      {row.value}
                    </div>
                    <div className="font-serif italic text-[10.5px] text-muted mt-0.5">
                      {row.ctx}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rivalries pillar */}
        <div className="border-l border-line pl-5">
          <Eyebrow>Streaks</Eyebrow>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Longest W" value="—" accent />
            <Stat label="Longest L" value="—" />
          </div>
          <div className="mt-3">
            <Eyebrow>Rivalries (H2H)</Eyebrow>
            <div className="mt-2">
              <StubBanner label="Head-to-head records vs each opponent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: Season History ────────────────────────────────────────────────

function SeasonHistory({
  familySeasons,
  currentRosterId,
}: {
  familySeasons: import("../types/fantasy").League[];
  currentRosterId: number | null;
}) {
  // Stub rows from league family — real finish/seed/postseason data TBD
  return (
    <section>
      <SectionHead
        kicker="Annals"
        title="Season by Season"
        rule="Finish · seed · postseason"
      />
      <div className="mt-2">
        {/* Header */}
        <div className="grid grid-cols-[52px_70px_80px_80px_60px_1fr_50px] gap-0 items-baseline pb-1 border-b border-line text-[9.5px] font-semibold tracking-wider uppercase text-muted font-sans">
          <div>Year</div>
          <div>Record</div>
          <div className="text-right">PF</div>
          <div className="text-right">PA</div>
          <div className="text-right">Seed</div>
          <div>Postseason</div>
          <div className="text-right">Pwr</div>
        </div>

        {familySeasons.length === 0 ? (
          <div className="py-4 text-[11px] text-muted font-sans italic">
            No season history available.
          </div>
        ) : (
          familySeasons.map((league) => (
            <div
              key={league.ref.leagueId}
              className="grid grid-cols-[52px_70px_80px_80px_60px_1fr_50px] gap-0 items-center py-2 border-b border-dotted border-line"
            >
              <div className="font-serif italic font-bold text-[17px] text-ink leading-none">
                {league.season}
              </div>
              {/* Record, PF, PA, seed, finish, power rank — all stub until
                  per-season roster data is aggregated */}
              <div className="font-mono text-xs text-muted">—</div>
              <div className="text-right font-mono text-xs text-muted">—</div>
              <div className="text-right font-mono text-xs text-muted">—</div>
              <div className="text-right font-serif italic text-sm text-muted">—</div>
              <div className="font-serif text-sm text-muted italic">
                {league.ref.leagueId === familySeasons[0]?.ref.leagueId
                  ? "In progress"
                  : "—"}
              </div>
              <div className="text-right font-mono text-xs text-muted">—</div>
            </div>
          ))
        )}

        {familySeasons.length > 0 && (
          <p className="text-[10px] text-muted font-sans italic mt-2">
            Per-season stats (record, seed, finish) will populate when the
            historical aggregation endpoint is added.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Section 5: Trophy Room ───────────────────────────────────────────────────

type TrophyTier = "gold" | "silver" | "bronze" | "ribbon" | "wood";

interface Trophy {
  id: string;
  title: string;
  sub: string;
  detail: string;
  year: string | number;
  tier: TrophyTier;
  kind: "cup" | "medal" | "ribbon" | "star" | "wood";
}

const TIER_STYLES: Record<
  TrophyTier,
  { border: string; bg: string; badge: string; text: string }
> = {
  gold: {
    border: "border-yellow-600/40",
    bg: "bg-yellow-50 dark:bg-yellow-900/10",
    badge: "bg-yellow-600 text-white",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  silver: {
    border: "border-gray-400/40",
    bg: "bg-gray-50 dark:bg-gray-800/20",
    badge: "bg-gray-500 text-white",
    text: "text-gray-500",
  },
  bronze: {
    border: "border-orange-700/40",
    bg: "bg-orange-50 dark:bg-orange-900/10",
    badge: "bg-orange-700 text-white",
    text: "text-orange-700 dark:text-orange-400",
  },
  ribbon: {
    border: "border-accent/30",
    bg: "bg-highlight",
    badge: "bg-accent text-white",
    text: "text-accent",
  },
  wood: {
    border: "border-line",
    bg: "bg-paper",
    badge: "bg-muted text-white",
    text: "text-muted",
  },
};

function TrophyGlyph({ kind, className }: { kind: Trophy["kind"]; className: string }) {
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.4,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "cup")
    return (
      <svg width="36" height="40" viewBox="0 0 36 40" className={className}>
        <path {...stroke} d="M8 4 H28 V14 C28 22 24 27 18 27 C12 27 8 22 8 14 Z" fillOpacity={0.15} fill="currentColor" />
        <path {...stroke} d="M8 8 H3 C3 14 6 17 9 17" />
        <path {...stroke} d="M28 8 H33 C33 14 30 17 27 17" />
        <path {...stroke} d="M14 27 V32 H22 V27" />
        <path {...stroke} d="M10 36 H26" strokeWidth={2.2} />
      </svg>
    );
  if (kind === "medal")
    return (
      <svg width="36" height="40" viewBox="0 0 36 40" className={className}>
        <path {...stroke} d="M12 2 L8 14 M24 2 L28 14" />
        <circle cx="18" cy="24" r="11" {...stroke} fillOpacity={0.15} fill="currentColor" />
        <circle cx="18" cy="24" r="6" {...stroke} />
      </svg>
    );
  if (kind === "ribbon")
    return (
      <svg width="36" height="40" viewBox="0 0 36 40" className={className}>
        <circle cx="18" cy="14" r="9" {...stroke} fillOpacity={0.15} fill="currentColor" />
        <path {...stroke} d="M11 21 L8 36 L14 32 L18 36 L22 32 L28 36 L25 21" />
      </svg>
    );
  if (kind === "star")
    return (
      <svg width="36" height="40" viewBox="0 0 36 40" className={className}>
        <path {...stroke} fillOpacity={0.15} fill="currentColor" d="M18 4 L22 14 L33 15 L24 22 L27 33 L18 27 L9 33 L12 22 L3 15 L14 14 Z" />
      </svg>
    );
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" className={className}>
      <rect x="6" y="10" width="24" height="22" {...stroke} fillOpacity={0.15} fill="currentColor" />
      <path {...stroke} d="M6 16 H30 M6 22 H30 M6 28 H30" />
    </svg>
  );
}

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const s = TIER_STYLES[trophy.tier];
  return (
    <div
      className={`relative flex flex-col p-3.5 border ${s.border} ${s.bg}`}
    >
      {/* Year badge */}
      <div
        className={`absolute top-0 right-0 px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wider ${s.badge}`}
      >
        {trophy.year}
      </div>

      {/* Glyph */}
      <TrophyGlyph kind={trophy.kind} className={`mb-2 ${s.text}`} />

      <div className="font-serif italic font-bold text-[14px] text-ink leading-tight tracking-tight">
        {trophy.title}
      </div>
      <div className="font-serif text-xs text-body mt-1 leading-snug">
        {trophy.sub}
      </div>
      <div className="flex-1" />
      <div className="mt-2 pt-1.5 border-t border-dotted border-line text-[9.5px] uppercase tracking-wider font-sans text-muted font-semibold">
        {trophy.detail}
      </div>
    </div>
  );
}

// Placeholder trophies shown when no real ones exist yet
const PLACEHOLDER_TROPHIES: Trophy[] = [
  {
    id: "stub-1",
    title: "Champion",
    sub: "League champion",
    detail: "1st place finish",
    year: "—",
    tier: "gold",
    kind: "cup",
  },
  {
    id: "stub-2",
    title: "Runner-Up",
    sub: "Championship finalist",
    detail: "2nd place finish",
    year: "—",
    tier: "silver",
    kind: "medal",
  },
  {
    id: "stub-3",
    title: "High Score",
    sub: "Most points in a week",
    detail: "Season superlative",
    year: "—",
    tier: "ribbon",
    kind: "star",
  },
];

function TrophyRoom({ awards }: { awards: Trophy[] }) {
  const display = awards.length > 0 ? awards : PLACEHOLDER_TROPHIES;
  const isStub = awards.length === 0;

  return (
    <section>
      <SectionHead
        kicker="The Mantelpiece"
        title="Trophy Room"
        rule={
          isStub
            ? "Superlatives · coming soon"
            : `${awards.length} award${awards.length !== 1 ? "s" : ""}`
        }
      />
      {isStub && (
        <p className="text-[11px] text-muted font-sans italic mb-3">
          Trophies are assigned by algorithms — shell is ready to receive them.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {display.map((a) => (
          <TrophyCard key={a.id} trophy={a} />
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TeamPage() {
  const { rosterId: rosterIdParam } = useParams<{ rosterId: string }>();
  const rosterId = rosterIdParam ? Number(rosterIdParam) : null;

  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );

  const { data: allLeagues } = useAllSleeperLeagues();
  const { data: selectedLeague } = useLeague(selectedLeagueId);
  const { data: nflState } = useNFLState();

  // Determine current week in the same way as DashboardPage
  const isLeagueCurrent =
    !!selectedLeague?.season &&
    !!nflState?.season &&
    selectedLeague.season === nflState.season &&
    nflState.season_type === "regular";
  const week = isLeagueCurrent ? (nflState!.display_week ?? nflState!.week ?? 1) : 17;

  const leagueSettings = selectedLeague?.settings ?? {};
  const lastScoredLeg =
    typeof leagueSettings["last_scored_leg"] === "number"
      ? (leagueSettings["last_scored_leg"] as number)
      : null;
  const playoffWeekStart =
    typeof leagueSettings["playoff_week_start"] === "number"
      ? (leagueSettings["playoff_week_start"] as number)
      : null;
  const leagueStatus = selectedLeague?.status;
  const isLeagueUnstarted =
    leagueStatus === "pre_draft" || leagueStatus === "drafting";
  const lastWeek = isLeagueUnstarted
    ? 0
    : (lastScoredLeg ?? (playoffWeekStart ? playoffWeekStart + 2 : 17));

  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { rosterId: myRosterId } = useMyClaimedTeam(
    allLeagues && selectedLeagueId
      ? (getFamilySeasons(selectedLeagueId, allLeagues)[0]?.ref.leagueId ?? selectedLeagueId)
      : null,
  );
  const { data: powerData } = usePowerRankings(selectedLeagueId);

  const familySeasons = useMemo(
    () =>
      selectedLeagueId && allLeagues
        ? getFamilySeasons(selectedLeagueId, allLeagues)
        : [],
    [selectedLeagueId, allLeagues],
  );

  // Season trail — fetch all scored weeks for this roster
  const seasonLog = useTeamSeasonLog(selectedLeagueId, rosterId, lastWeek);

  const roster = rosters?.find((r) => r.rosterId === rosterId) ?? null;
  const user = roster?.ownerId
    ? leagueUsers?.find((u) => u.userId === roster.ownerId)
    : null;

  const teamName =
    user?.teamName ?? user?.displayName ?? (roster ? `Team ${roster.rosterId}` : null);
  const isMyTeam = rosterId !== null && rosterId === myRosterId;

  // Power rank for this roster from power rankings data
  const powerRank = useMemo(() => {
    if (!powerData || !rosterId) return null;
    const row = powerData.rows.find((r) => r.rosterId === rosterId);
    if (!row) return null;
    return powerData.rows.indexOf(row) + 1;
  }, [powerData, rosterId]);

  if (!roster) {
    return (
      <div className="p-6 text-muted font-sans text-sm">
        {rosters ? "Team not found." : "Loading…"}
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-full">
      <Masthead
        teamName={teamName ?? `Team ${roster.rosterId}`}
        ownerName={user?.displayName ?? null}
        avatar={user?.avatar ?? null}
        record={roster.record}
        streak={roster.streak}
        pf={roster.pointsFor}
        pa={roster.pointsAgainst}
        powerRank={powerRank}
        season={selectedLeague?.season ?? "—"}
        isMyTeam={isMyTeam}
      />

      <div className="px-6 py-5 flex flex-col gap-8">
        <CurrentSeason roster={roster} log={seasonLog} week={week} />
        <LifetimeStats />
        <SeasonHistory
          familySeasons={familySeasons}
          currentRosterId={rosterId}
        />
        <TrophyRoom awards={[]} />
      </div>
    </div>
  );
}
