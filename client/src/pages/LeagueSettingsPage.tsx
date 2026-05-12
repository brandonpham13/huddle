/**
 * LeagueSettingsPage — per-league settings for members.
 *
 * Accessible to all league members (not commissioner-only).
 * Route: /league-settings
 *
 * Current sections:
 *   - Teams list  — all rosters with claim status; members can claim/unclaim
 *
 * Planned sections (stubs):
 *   - User Preferences — notification settings, display preferences, etc.
 */
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import {
  useMyHuddles,
  useHuddleDetail,
  useSubmitClaim,
  useRemoveClaim,
} from "../hooks/useHuddles";
import type { Roster, TeamUser } from "../types/fantasy";
import type { HuddleClaimSummary } from "../types/huddle";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rosterTeamName(roster: Roster, leagueUsers: TeamUser[]): string {
  const owner = roster.ownerId
    ? leagueUsers.find((u) => u.userId === roster.ownerId)
    : null;
  return owner?.teamName ?? owner?.displayName ?? `Team ${roster.rosterId}`;
}

function describeUser(u: { id: string; username: string | null; email: string | null } | null | undefined): string {
  if (!u) return "Unknown";
  return u.username ?? u.email ?? u.id;
}

// ─── Teams table ─────────────────────────────────────────────────────────────

function TeamsTable({
  huddleId,
  rosters,
  leagueUsers,
  claims,
  myClaim,
  currentUserId,
  isCommissioner,
  commissionerCount,
}: {
  huddleId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
  claims: HuddleClaimSummary[];
  myClaim: { id: string; rosterId: number; status: string } | null;
  currentUserId: string | null;
  isCommissioner: boolean;
  commissionerCount: number;
}) {
  const submit = useSubmitClaim();
  const removeClaim = useRemoveClaim();
  const [claimingRosterId, setClaimingRosterId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [confirmRemoveClaimId, setConfirmRemoveClaimId] = useState<string | null>(null);

  const approvedByRoster = useMemo(() => {
    const map = new Map<number, HuddleClaimSummary>();
    for (const c of claims) {
      if (c.status === "approved") map.set(c.rosterId, c);
    }
    return map;
  }, [claims]);

  const pendingByRoster = useMemo(() => {
    const map = new Map<number, HuddleClaimSummary>();
    for (const c of claims) {
      if (c.status === "pending") map.set(c.rosterId, c);
    }
    return map;
  }, [claims]);

  const sorted = useMemo(
    () => [...rosters].sort((a, b) => a.rosterId - b.rosterId),
    [rosters],
  );

  const hasPendingClaim = myClaim?.status === "pending";
  const hasApprovedClaim = myClaim?.status === "approved";
  const canClaimNew = !hasPendingClaim && !hasApprovedClaim;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Claim your team so the dashboard knows who you are. One claim per
          member — pending claims need commissioner approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {sorted.map((roster) => {
            const claim = approvedByRoster.get(roster.rosterId);
            const pendingClaim = pendingByRoster.get(roster.rosterId);
            const teamName = rosterTeamName(roster, leagueUsers);
            const isMyTeam = claim?.user?.id === currentUserId;
            const isMyPendingClaim =
              pendingClaim?.user?.id === currentUserId ||
              (myClaim?.rosterId === roster.rosterId && myClaim?.status === "pending");
            const isExpanding = claimingRosterId === roster.rosterId;
            const selfUnlinkBlocked = isMyTeam && isCommissioner && commissionerCount <= 1;

            return (
              <div key={roster.rosterId} className="border-b last:border-b-0">
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted w-5 font-mono">
                      {roster.rosterId}
                    </span>
                    <span className="text-sm font-medium text-ink truncate">
                      {teamName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {claim ? (
                      <>
                        <span className="text-xs text-muted">
                          <span className="font-medium text-ink">
                            {describeUser(claim.user)}
                          </span>
                        </span>
                        {(isMyTeam || isCommissioner) &&
                          confirmRemoveClaimId !== claim.id ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={selfUnlinkBlocked}
                                  onClick={() => setConfirmRemoveClaimId(claim.id)}
                                >
                                  Unlink
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {selfUnlinkBlocked && (
                              <TooltipContent>
                                Assign another commissioner before unlinking yourself
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ) : (isMyTeam || isCommissioner) &&
                          confirmRemoveClaimId === claim.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => setConfirmRemoveClaimId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                              disabled={removeClaim.isPending}
                              onClick={() =>
                                removeClaim.mutate(
                                  { huddleId, claimId: claim.id, isCommissioner },
                                  { onSuccess: () => setConfirmRemoveClaimId(null) },
                                )
                              }
                            >
                              Confirm
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : pendingClaim ? (
                      <>
                        <span className="text-xs text-muted">
                          {pendingClaim.user ? (
                            <span className="font-medium text-ink">
                              {describeUser(pendingClaim.user)}
                            </span>
                          ) : (
                            <span className="italic">Pending request</span>
                          )}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Pending
                        </span>
                        {(isMyPendingClaim || isCommissioner) &&
                          confirmRemoveClaimId !== pendingClaim.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                            onClick={() => setConfirmRemoveClaimId(pendingClaim.id)}
                          >
                            {isMyPendingClaim ? "Withdraw" : "Remove"}
                          </Button>
                        ) : (isMyPendingClaim || isCommissioner) &&
                          confirmRemoveClaimId === pendingClaim.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => setConfirmRemoveClaimId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                              disabled={removeClaim.isPending}
                              onClick={() =>
                                removeClaim.mutate(
                                  { huddleId, claimId: pendingClaim.id, isCommissioner },
                                  { onSuccess: () => setConfirmRemoveClaimId(null) },
                                )
                              }
                            >
                              Confirm
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted">Unclaimed</span>
                        {canClaimNew && !isExpanding && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setClaimingRosterId(roster.rosterId);
                              setMessage("");
                            }}
                          >
                            Claim
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Inline claim form */}
                {isExpanding && (
                  <div className="pb-3 pl-8 space-y-2">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="w-full text-sm border rounded-md px-2 py-1"
                      placeholder="Message for the commissioner (optional)"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClaimingRosterId(null)}
                        disabled={submit.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={submit.isPending}
                        onClick={() =>
                          submit.mutate(
                            { huddleId, rosterId: roster.rosterId, message: message.trim() || undefined },
                            { onSuccess: () => { setClaimingRosterId(null); setMessage(""); } },
                          )
                        }
                      >
                        {submit.isPending ? "Submitting…" : "Submit claim"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length === 0 && (
            <p className="text-sm text-muted py-2">No rosters loaded yet.</p>
          )}
        </div>

        {myClaim?.status === "pending" && (
          <p className="text-xs text-amber-600 mt-3">
            Your claim for roster #{myClaim.rosterId} is pending approval.
          </p>
        )}
        {(submit.error || removeClaim.error) && (
          <p className="text-xs text-red-500 mt-3">
            {((submit.error ?? removeClaim.error) as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LeagueSettingsPage() {
  const { userId } = useAuth();
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);

  // Find the huddle linked to this league
  const { data: huddles } = useMyHuddles();
  const huddle = useMemo(
    () => huddles?.find((h) => h.leagueId === selectedLeagueId) ?? null,
    [huddles, selectedLeagueId],
  );
  const huddleDetail = useHuddleDetail(huddle?.id ?? null);
  const detail = huddleDetail.data;

  const isCommissioner = !!detail?.huddle.isCommissioner;

  if (!selectedLeagueId) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full bg-paper text-ink font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">

        {/* Page header */}
        <div className="mb-8 pb-5 border-b border-line">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">
            League Settings
          </p>
          <h1 className="font-serif text-3xl font-bold text-ink leading-tight flex items-center gap-3">
            <Settings size={24} className="text-muted" />
            Settings
          </h1>
          <p className="mt-1.5 text-[13px] text-muted font-sans">
            Manage your team claim and league preferences.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {huddle && detail ? (
            <TeamsTable
              huddleId={huddle.id}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
              claims={detail.claims}
              myClaim={detail.myClaim}
              currentUserId={userId ?? null}
              isCommissioner={isCommissioner}
              commissionerCount={detail.huddle.commissioners.length}
            />
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted">
                {huddle
                  ? "Loading…"
                  : "No huddle is linked to this league. Ask your commissioner to set one up."}
              </CardContent>
            </Card>
          )}

          {/* User preferences stub */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Preferences</CardTitle>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted font-sans border border-line rounded px-1.5 py-0.5">
                  Coming soon
                </span>
              </div>
              <CardDescription>
                Notification settings, display preferences, and other
                per-league options will live here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-14 rounded-md bg-highlight/50 border border-dashed border-line flex items-center justify-center">
                <span className="text-[11px] text-muted font-sans italic">
                  Settings will appear here
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
