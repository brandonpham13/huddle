import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ChevronLeft } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  useDecideClaim,
  useDeleteHuddle,
  useHuddleDetail,
  useHuddlePendingClaims,
  useAddCommissioner,
  useRemoveCommissioner,
  useRemoveClaim,
  useRotateInviteCode,
  useSubmitClaim,
  useUpdateHuddle,
} from "../hooks/useHuddles";
import {
  useLeague,
  useLeagueRosters,
  useLeagueUsers,
} from "../hooks/useSleeper";
import type { Roster, TeamUser } from "../types/fantasy";
import type {
  CommissionerSummary,
  HuddleClaimSummary,
  UserSummary,
} from "../types/huddle";

function describeUser(u: UserSummary | null | undefined): string {
  if (!u) return "Unknown user";
  return u.username ?? u.email ?? u.id;
}

export function HuddleDetailPage() {
  const { userId } = useAuth();
  const { id: huddleId } = useParams<{ id: string }>();
  const huddleQuery = useHuddleDetail(huddleId ?? null);
  const detail = huddleQuery.data;
  const isCommissioner = !!detail?.huddle.isCommissioner;

  // Sleeper roster/user data for the league this huddle belongs to
  const leagueId = detail?.huddle.leagueId ?? null;
  const { data: league } = useLeague(leagueId);
  const { data: rosters } = useLeagueRosters(leagueId);
  const { data: leagueUsers } = useLeagueUsers(leagueId);

  if (!huddleId) return <div className="p-6 text-muted">No huddle id.</div>;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="bg-chrome border-b border-line px-6 py-4 flex items-center gap-4">
        <Link
          to="/leagues"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft size={14} />
          Leagues
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
            <Card>
              <CardHeader>
                <CardTitle>{detail.huddle.name}</CardTitle>
                <CardDescription>
                  League: {league?.name ?? detail.huddle.leagueId}
                  {" · "}
                  Commissioners:{" "}
                  {detail.huddle.commissioners
                    .map((c) => describeUser(c.user))
                    .join(", ")}
                </CardDescription>
              </CardHeader>
            </Card>

            <RosterTable
              huddleId={huddleId}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
              claims={detail.claims}
              myClaim={detail.myClaim}
              currentUserId={userId ?? null}
              isCommissioner={isCommissioner}
              commissionerCount={detail.huddle.commissioners.length}
            />

            {isCommissioner && (
              <CommissionerPendingPanel
                huddleId={huddleId}
                rosters={rosters ?? []}
                leagueUsers={leagueUsers ?? []}
              />
            )}

            {isCommissioner && (
              <CommissionerSettings
                huddleId={huddleId}
                inviteCode={detail.huddle.inviteCode}
              />
            )}

            {isCommissioner && (
              <ManageCommissioners
                huddleId={huddleId}
                commissioners={detail.huddle.commissioners}
                claims={detail.claims}
              />
            )}

            {isCommissioner && (
              <DangerZone
                huddleId={huddleId}
                groupName={detail.huddle.name}
                leagueProvider={detail.huddle.leagueProvider}
                leagueId={detail.huddle.leagueId}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---- Roster table ----

function rosterTeamName(roster: Roster, leagueUsers: TeamUser[]): string {
  const owner = roster.ownerId
    ? leagueUsers.find((u) => u.userId === roster.ownerId)
    : null;
  return owner?.teamName ?? owner?.displayName ?? `Team ${roster.rosterId}`;
}

function RosterTable({
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
  const [confirmRemoveClaimId, setConfirmRemoveClaimId] = useState<
    string | null
  >(null);

  const approvedByRoster = useMemo(() => {
    const map = new Map<number, HuddleClaimSummary>();
    for (const c of claims) {
      if (c.status === "approved") map.set(c.rosterId, c);
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

  const mutationError = submit.error ?? removeClaim.error ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Claim status for every roster in this huddle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map((roster) => {
            const claim = approvedByRoster.get(roster.rosterId);
            const teamName = rosterTeamName(roster, leagueUsers);
            const isMyTeam = claim && claim.user?.id === currentUserId;
            const isExpanding = claimingRosterId === roster.rosterId;
            // Last-commish self-unlink guard
            const selfUnlinkBlocked =
              isMyTeam && isCommissioner && commissionerCount <= 1;

            return (
              <div key={roster.rosterId} className="border-b last:border-b-0">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-5">
                      {roster.rosterId}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {teamName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {claim ? (
                      <>
                        <span className="text-xs text-gray-500">
                          <span className="font-medium text-gray-900">
                            {describeUser(claim.user)}
                          </span>
                        </span>
                        {/* Unlink: own team or commissioner on any team */}
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
                                  onClick={() =>
                                    setConfirmRemoveClaimId(claim.id)
                                  }
                                >
                                  Unlink
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {selfUnlinkBlocked && (
                              <TooltipContent>
                                Assign another commissioner before unlinking
                                yourself
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
                              onClick={() => {
                                removeClaim.mutate(
                                  {
                                    huddleId,
                                    claimId: claim.id,
                                    isCommissioner,
                                  },
                                  {
                                    onSuccess: () =>
                                      setConfirmRemoveClaimId(null),
                                  },
                                );
                              }}
                            >
                              Confirm
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400">Unclaimed</span>
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
                        onClick={() => {
                          submit.mutate(
                            {
                              huddleId,
                              rosterId: roster.rosterId,
                              message: message.trim() || undefined,
                            },
                            {
                              onSuccess: () => {
                                setClaimingRosterId(null);
                                setMessage("");
                              },
                            },
                          );
                        }}
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
            <p className="text-sm text-gray-500">No rosters loaded yet.</p>
          )}
        </div>
        {myClaim?.status === "pending" && (
          <p className="text-xs text-amber-600 mt-3">
            Your claim for roster #{myClaim.rosterId} is pending approval.
          </p>
        )}
        {mutationError && (
          <p className="text-xs text-red-500 mt-3">
            {(mutationError as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Commissioner pending panel ----

function CommissionerPendingPanel({
  huddleId,
  rosters,
  leagueUsers,
}: {
  huddleId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
}) {
  const claimsQuery = useHuddlePendingClaims(huddleId, true);
  const decide = useDecideClaim();
  const pending = (claimsQuery.data ?? []).filter(
    (c) => c.status === "pending",
  );

  const teamNameForRoster = (rosterId: number) => {
    const r = rosters.find((x) => x.rosterId === rosterId);
    return r ? rosterTeamName(r, leagueUsers) : `Team ${rosterId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending claims</CardTitle>
        <CardDescription>
          {pending.length === 0
            ? "No pending requests."
            : `${pending.length} waiting for review.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((claim) => (
              <div key={claim.id} className="border rounded-md p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {describeUser(claim.user)}
                    </p>
                    <p className="text-xs text-gray-500">
                      requesting{" "}
                      <span className="font-medium text-gray-700">
                        {teamNameForRoster(claim.rosterId)}
                      </span>
                      {claim.user?.email && claim.user.username
                        ? ` · ${claim.user.email}`
                        : ""}
                    </p>
                    {claim.message && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "{claim.message}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide.mutate({
                          huddleId,
                          claimId: claim.id,
                          decision: "rejected",
                        })
                      }
                      disabled={decide.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        decide.mutate({
                          huddleId,
                          claimId: claim.id,
                          decision: "approved",
                        })
                      }
                      disabled={decide.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {decide.isError && (
          <p className="text-xs text-red-500 mt-2">
            {(decide.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Commissioner settings (invite code) ----

function CommissionerSettings({
  huddleId,
  inviteCode,
}: {
  huddleId: string;
  inviteCode?: string;
}) {
  const rotate = useRotateInviteCode();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const displayCode = rotate.data?.inviteCode ?? inviteCode;

  const handleCopy = () => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite code</CardTitle>
        <CardDescription>
          Share this with members so they can join and claim a team. Rotate it
          to invalidate the old code immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-center bg-gray-50 border rounded-md py-2 font-mono text-2xl font-bold tracking-widest text-gray-900">
              {displayCode ?? "———"}
            </div>
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          {!confirming ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Rotate code…
            </Button>
          ) : (
            <div className="space-y-2 p-3 rounded-md border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-800">
                The old code stops working immediately. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={rotate.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    rotate.mutate(
                      { huddleId },
                      { onSuccess: () => setConfirming(false) },
                    )
                  }
                  disabled={rotate.isPending}
                >
                  {rotate.isPending ? "Rotating…" : "Yes, rotate"}
                </Button>
              </div>
            </div>
          )}

          {rotate.isError && (
            <p className="text-xs text-red-500">
              {(rotate.error as Error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Manage commissioners ----

function ManageCommissioners({
  huddleId,
  commissioners,
  claims,
}: {
  huddleId: string;
  commissioners: CommissionerSummary[];
  claims: HuddleClaimSummary[];
}) {
  const add = useAddCommissioner();
  const remove = useRemoveCommissioner();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Approved members who aren't already commissioners
  const commissionerIds = new Set(commissioners.map((c) => c.userId));
  const eligible = claims.filter(
    (c) => c.status === "approved" && !commissionerIds.has(c.user?.id ?? ""),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commissioners</CardTitle>
        <CardDescription>
          Co-commissioners can approve claims, rotate the invite code, and
          manage the huddle. There must always be at least one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current commissioners */}
          <div className="space-y-1">
            {commissioners.map((c) => (
              <div
                key={c.userId}
                className="flex items-center justify-between text-sm py-1"
              >
                <span>{describeUser(c.user)}</span>
                {commissioners.length > 1 && confirmRemoveId !== c.userId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                    onClick={() => setConfirmRemoveId(c.userId)}
                  >
                    Remove
                  </Button>
                ) : confirmRemoveId === c.userId ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                      disabled={remove.isPending}
                      onClick={() => {
                        remove.mutate(
                          { huddleId, targetUserId: c.userId },
                          { onSuccess: () => setConfirmRemoveId(null) },
                        );
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">last commish</span>
                )}
              </div>
            ))}
          </div>

          {/* Add co-commissioner */}
          {eligible.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 mb-2">Add co-commissioner</p>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="">Select a member…</option>
                  {eligible.map((c) => (
                    <option key={c.id} value={c.user?.id ?? ""}>
                      {describeUser(c.user)}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!selectedUserId || add.isPending}
                  onClick={() => {
                    add.mutate(
                      { huddleId, newUserId: selectedUserId },
                      { onSuccess: () => setSelectedUserId("") },
                    );
                  }}
                >
                  {add.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
          )}

          {(add.isError || remove.isError) && (
            <p className="text-xs text-red-500">
              {((add.error ?? remove.error) as Error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Danger zone (commissioner-only delete) ----

function DangerZone({
  huddleId,
  groupName,
  leagueProvider,
  leagueId,
}: {
  huddleId: string;
  groupName: string;
  leagueProvider: string;
  leagueId: string;
}) {
  const del = useDeleteHuddle();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText.trim() === groupName && !del.isPending;

  const handleDelete = () => {
    del.mutate(
      { huddleId, leagueProvider, leagueId },
      {
        onSuccess: () => {
          navigate("/leagues");
        },
      },
    );
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">Danger zone</CardTitle>
        <CardDescription>
          Deleting the huddle removes all claims permanently. This can't be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Delete huddle
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              Type <span className="font-mono font-medium">{groupName}</span> to
              confirm:
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full text-sm border rounded-md px-2 py-1.5"
              placeholder={groupName}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                disabled={del.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete}
                onClick={handleDelete}
              >
                {del.isPending ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
            {del.isError && (
              <p className="text-xs text-red-500">
                {(del.error as Error).message}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
