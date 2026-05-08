import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  useDeleteGroup,
  useGroupDetail,
  useGroupPendingClaims,
  usePromoteCommissioner,
  useRevokeClaim,
  useRotateInviteCode,
  useSubmitClaim,
  useUpdateGroup,
} from "../hooks/useGroups";
import {
  useLeague,
  useLeagueRosters,
  useLeagueUsers,
} from "../hooks/useSleeper";
import type { Roster, TeamUser } from "../types/fantasy";
import type { GroupClaimSummary, UserSummary } from "../types/group";

function describeUser(u: UserSummary | null | undefined): string {
  if (!u) return "Unknown user";
  return u.username ?? u.email ?? u.id;
}

export function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const groupQuery = useGroupDetail(groupId ?? null);
  const detail = groupQuery.data;
  const isCommissioner = !!detail?.group.isCommissioner;

  const leagueId = detail?.group.leagueId ?? null;
  const { data: league } = useLeague(leagueId);
  const { data: rosters } = useLeagueRosters(leagueId);
  const { data: leagueUsers } = useLeagueUsers(leagueId);

  if (!groupId) return <div className="p-6 text-gray-500">No group id.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link
          to="/leagues"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Leagues
        </Link>
        <h1 className="text-xl font-bold">{detail?.group.name ?? "Group"}</h1>
      </nav>

      <main className="p-6 max-w-3xl mx-auto space-y-4">
        {groupQuery.isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        )}
        {groupQuery.isError && (
          <Card>
            <CardContent className="py-8 text-center text-red-500">
              Failed to load group.
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{detail.group.name}</CardTitle>
                <CardDescription>
                  League: {league?.name ?? detail.group.leagueId}
                  {" · "}
                  Commissioner: {describeUser(detail.group.commissioner)}
                </CardDescription>
              </CardHeader>
            </Card>

            <RosterTable
              groupId={groupId}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
              claims={detail.claims}
              isCommissioner={isCommissioner}
            />

            {!isCommissioner && (
              <ClaimTeamCard
                groupId={groupId}
                rosters={rosters ?? []}
                leagueUsers={leagueUsers ?? []}
                claims={detail.claims}
                myClaim={detail.myClaim}
              />
            )}

            {isCommissioner && (
              <CommissionerPendingPanel
                groupId={groupId}
                rosters={rosters ?? []}
                leagueUsers={leagueUsers ?? []}
              />
            )}

            {isCommissioner && (
              <CommissionerSettings
                groupId={groupId}
                inviteCode={detail.group.inviteCode}
              />
            )}

            {isCommissioner && (
              <PromoteCommissionerCard
                groupId={groupId}
                claims={detail.claims}
              />
            )}

            {isCommissioner && (
              <DangerZone
                groupId={groupId}
                groupName={detail.group.name}
                leagueProvider={detail.group.leagueProvider}
                leagueId={detail.group.leagueId}
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
  groupId,
  rosters,
  leagueUsers,
  claims,
  isCommissioner,
}: {
  groupId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
  claims: GroupClaimSummary[];
  isCommissioner: boolean;
}) {
  const revoke = useRevokeClaim();

  const approvedByRoster = useMemo(() => {
    const map = new Map<number, GroupClaimSummary>();
    for (const c of claims) {
      if (c.status === "approved") map.set(c.rosterId, c);
    }
    return map;
  }, [claims]);

  const sorted = useMemo(
    () => [...rosters].sort((a, b) => a.rosterId - b.rosterId),
    [rosters],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Claim status for every roster in this group.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map((roster) => {
            const claim = approvedByRoster.get(roster.rosterId);
            const teamName = rosterTeamName(roster, leagueUsers);
            return (
              <div
                key={roster.rosterId}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 w-5">
                    {roster.rosterId}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {teamName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {claim ? (
                    <>
                      <span>
                        Claimed by{" "}
                        <span className="font-medium text-gray-900">
                          {describeUser(claim.user)}
                        </span>
                      </span>
                      {isCommissioner && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                          disabled={revoke.isPending}
                          onClick={() =>
                            revoke.mutate({ groupId, claimId: claim.id })
                          }
                        >
                          Revoke
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">Unclaimed</span>
                  )}
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-sm text-gray-500">No rosters loaded yet.</p>
          )}
        </div>
        {revoke.isError && (
          <p className="text-xs text-red-500 mt-2">
            {(revoke.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Claim form ----

function ClaimTeamCard({
  groupId,
  rosters,
  leagueUsers,
  claims,
  myClaim,
}: {
  groupId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
  claims: GroupClaimSummary[];
  myClaim: {
    id: string;
    rosterId: number;
    status: "pending" | "approved" | "rejected" | "revoked";
  } | null;
}) {
  const submit = useSubmitClaim();
  const [rosterId, setRosterId] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");

  const approvedRosterIds = useMemo(
    () =>
      new Set(
        claims.filter((c) => c.status === "approved").map((c) => c.rosterId),
      ),
    [claims],
  );
  const availableRosters = useMemo(
    () =>
      rosters
        .filter((r) => !approvedRosterIds.has(r.rosterId))
        .sort((a, b) => a.rosterId - b.rosterId),
    [rosters, approvedRosterIds],
  );

  if (myClaim?.status === "approved") {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-green-700">
          You're approved as roster #{myClaim.rosterId}.
        </CardContent>
      </Card>
    );
  }

  if (myClaim?.status === "pending") {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-amber-700">
          Your claim for roster #{myClaim.rosterId} is pending commissioner
          approval.
        </CardContent>
      </Card>
    );
  }

  if (myClaim?.status === "revoked") {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-red-700">
          Your team ownership was revoked by the commissioner. Contact them if
          you think this is a mistake.
        </CardContent>
      </Card>
    );
  }

  const canSubmit =
    rosterId !== null && inviteCode.length === 6 && !submit.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim a team</CardTitle>
        <CardDescription>
          Enter the group invite code to request your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Team</label>
            <select
              value={rosterId ?? ""}
              onChange={(e) =>
                setRosterId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">Select a team…</option>
              {availableRosters.map((r) => (
                <option key={r.rosterId} value={r.rosterId}>
                  {rosterTeamName(r, leagueUsers)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Invite code
            </label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full text-sm font-mono tracking-widest text-center border rounded-md px-2 py-1.5 uppercase"
              placeholder="ABC123"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full text-sm border rounded-md px-2 py-1.5"
              placeholder="A note for the commissioner…"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-500">
              {submit.isError ? (submit.error as Error).message : ""}
            </span>
            <Button
              disabled={!canSubmit}
              onClick={() => {
                if (rosterId == null) return;
                submit.mutate(
                  {
                    groupId,
                    rosterId,
                    inviteCode,
                    message: message.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setInviteCode("");
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
      </CardContent>
    </Card>
  );
}

// ---- Commissioner pending panel ----

function CommissionerPendingPanel({
  groupId,
  rosters,
  leagueUsers,
}: {
  groupId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
}) {
  const claimsQuery = useGroupPendingClaims(groupId, true);
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
                          groupId,
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
                          groupId,
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
  groupId,
  inviteCode,
}: {
  groupId: string;
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

  const handleRotate = () => {
    rotate.mutate({ groupId }, { onSuccess: () => setConfirming(false) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite code</CardTitle>
        <CardDescription>
          Share this with members so they can join and claim a team. Rotate it
          if you want to stop accepting new members with the old code.
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
                The old code will stop working immediately. Members with the old
                code can't join. Continue?
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
                  onClick={handleRotate}
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

// ---- Promote commissioner ----

function PromoteCommissionerCard({
  groupId,
  claims,
}: {
  groupId: string;
  claims: GroupClaimSummary[];
}) {
  const promote = usePromoteCommissioner();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Only approved, non-commissioner members can be promoted
  const eligibleMembers = claims.filter((c) => c.status === "approved");

  if (eligibleMembers.length === 0) return null;

  const selectedMember = eligibleMembers.find(
    (c) => c.user?.id === selectedUserId,
  );

  const handlePromote = () => {
    if (!selectedUserId) return;
    promote.mutate(
      { groupId, newCommissionerUserId: selectedUserId },
      {
        onSuccess: () => {
          setConfirming(false);
          setSelectedUserId("");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer commissioner role</CardTitle>
        <CardDescription>
          Make another team owner the commissioner. You'll lose your
          commissioner privileges.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              New commissioner
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setConfirming(false);
              }}
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-white"
            >
              <option value="">Select a member…</option>
              {eligibleMembers.map((c) => (
                <option key={c.id} value={c.user?.id ?? ""}>
                  {describeUser(c.user)}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && !confirming && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Transfer to {describeUser(selectedMember?.user)}…
            </Button>
          )}

          {confirming && (
            <div className="space-y-2 p-3 rounded-md border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-800">
                <strong>{describeUser(selectedMember?.user)}</strong> will
                become the commissioner. You'll no longer have commissioner
                access. This can't be undone by you.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={promote.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handlePromote}
                  disabled={promote.isPending}
                >
                  {promote.isPending ? "Transferring…" : "Yes, transfer"}
                </Button>
              </div>
            </div>
          )}

          {promote.isError && (
            <p className="text-xs text-red-500">
              {(promote.error as Error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Danger zone (commissioner-only delete) ----

function DangerZone({
  groupId,
  groupName,
  leagueProvider,
  leagueId,
}: {
  groupId: string;
  groupName: string;
  leagueProvider: string;
  leagueId: string;
}) {
  const del = useDeleteGroup();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText.trim() === groupName && !del.isPending;

  const handleDelete = () => {
    del.mutate(
      { groupId, leagueProvider, leagueId },
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
          Deleting the group removes all claims permanently. This can't be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Delete group
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
