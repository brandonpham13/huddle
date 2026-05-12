/**
 * HuddleDetailPage — landing page for a specific huddle.
 *
 * Commissioner-specific controls (pending claims, invite code, commissioner
 * assignment, danger zone) have moved to CommissionerPage (/commissioner).
 *
 * The teams/roster table has moved to LeagueSettingsPage (/league-settings).
 *
 * This page now handles only:
 *   - Huddle info card (name, linked league, commissioners)
 *   - Link-a-league panel for commissioners who haven't linked yet
 *   - Fallback message for non-commissioners with no league linked
 */
import { Link, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  useHuddleDetail,
  useLinkLeague,
} from "../hooks/useHuddles";
import { useAllSleeperLeagues, useLeague } from "../hooks/useSleeper";
import { buildFamilyRootMap } from "../utils/leagueFamily";
import type { UserSummary } from "../types/huddle";

function describeUser(u: UserSummary | null | undefined): string {
  if (!u) return "Unknown user";
  return u.username ?? u.email ?? u.id;
}

export function HuddleDetailPage() {
  const { id: huddleId } = useParams<{ id: string }>();
  const huddleQuery = useHuddleDetail(huddleId ?? null);
  const detail = huddleQuery.data;
  const isCommissioner = !!detail?.huddle.isCommissioner;

  const leagueId = detail?.huddle.leagueId ?? null;
  const { data: league } = useLeague(leagueId);

  if (!huddleId) return <div className="p-6 text-muted">No huddle id.</div>;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="bg-chrome border-b border-line px-6 py-4 flex items-center gap-4">
        <Link
          to="/huddles"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft size={14} />
          Huddles
        </Link>
        <h1 className="text-xl font-bold text-ink">
          {detail?.huddle.name ?? "Group"}
        </h1>
      </nav>

      <main className="p-6 max-w-3xl mx-auto space-y-4">
        {huddleQuery.isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ink" />
          </div>
        )}
        {huddleQuery.isError && (
          <Card>
            <CardContent className="py-8 text-center text-red-500">
              Failed to load huddle.
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            {/* Info card */}
            <Card>
              <CardHeader>
                <CardTitle>{detail.huddle.name}</CardTitle>
                <CardDescription>
                  {detail.huddle.leagueId
                    ? `League: ${league?.name ?? detail.huddle.leagueId}`
                    : "No league linked yet"}
                  {" · "}Commissioners:{" "}
                  {detail.huddle.commissioners
                    .map((c) => describeUser(c.user))
                    .join(", ")}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Commissioner can link a league when none is set */}
            {isCommissioner && !detail.huddle.leagueId && (
              <LinkLeaguePanel huddleId={huddleId} />
            )}

            {/* Non-commissioner, no league linked yet */}
            {!isCommissioner && !detail.huddle.leagueId && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted">
                  The commissioner hasn't linked a Sleeper league yet. Check
                  back soon.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Link League panel ────────────────────────────────────────────────────────

function LinkLeaguePanel({ huddleId }: { huddleId: string }) {
  const { data: allLeagues, isLoading } = useAllSleeperLeagues();
  const linkLeague = useLinkLeague();
  const [selectedLeagueId, setSelectedLeagueId] = useState("");

  const options = useMemo(() => {
    if (!allLeagues) return [];
    const familyRootMap = buildFamilyRootMap(allLeagues);
    const seen = new Set<string>();
    const result: typeof allLeagues = [];
    for (const l of [...allLeagues].sort(
      (a, b) => Number(b.season) - Number(a.season),
    )) {
      const root = familyRootMap.get(l.ref.leagueId) ?? l.ref.leagueId;
      if (seen.has(root)) continue;
      seen.add(root);
      result.push(l);
    }
    return result;
  }, [allLeagues]);

  const selectedLeague = options.find((l) => l.ref.leagueId === selectedLeagueId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link a league</CardTitle>
        <CardDescription>
          Choose the Sleeper league this huddle is for. Members will then be
          able to claim their team rosters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted">Loading leagues…</p>}
        {!isLoading && options.length === 0 && (
          <p className="text-sm text-muted">
            No Sleeper leagues found. Make sure your Sleeper account is
            connected in Account → Integrations.
          </p>
        )}
        {options.length > 0 && (
          <div className="space-y-3">
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">— Select a league —</option>
              {options.map((l) => (
                <option key={l.ref.leagueId} value={l.ref.leagueId}>
                  {l.name} ({l.season})
                </option>
              ))}
            </select>
            <Button
              disabled={!selectedLeagueId || linkLeague.isPending}
              onClick={() => {
                if (!selectedLeagueId) return;
                linkLeague.mutate({
                  huddleId,
                  leagueProvider: "sleeper",
                  leagueId: selectedLeagueId,
                  leagueName: selectedLeague?.name,
                });
              }}
            >
              {linkLeague.isPending ? "Linking…" : "Link league"}
            </Button>
            {linkLeague.isError && (
              <p className="text-xs text-red-500">
                {(linkLeague.error as Error).message}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
