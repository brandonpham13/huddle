/**
 * CommissionerPage — admin control panel for league commissioners.
 *
 * Access: only rendered when the current user is the Sleeper commissioner
 * (isOwner = true) for the selected league. The sidebar entry is also
 * conditionally hidden for non-commissioners, so this page is doubly-gated.
 *
 * Commissioner sections (huddle-management controls lifted from HuddleDetailPage):
 *   - Pending Claims    review + approve/reject team claim requests
 *   - Invite Code       copy / rotate the join code
 *   - Manage Commissioners  add/remove co-commissioners
 *   - Danger Zone       delete the huddle
 *
 * League-management stubs (to be wired in future PRs):
 *   - Announcements   post league-wide messages pinned to the dashboard
 *   - Dues Tracker    mark who has/hasn't paid, set amounts
 *   - Payout Builder  define payout structure (1st, 2nd, 3rd, etc.)
 *   - Custom Awards   grant trophy-style awards to any team
 */
import { useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Megaphone, DollarSign, Trophy, Award } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAppSelector } from "../store/hooks";
import { useLeagueUsers, useLeagueRosters } from "../hooks/useSleeper";
import {
  useMyHuddles,
  useHuddleDetail,
  useHuddlePendingClaims,
  useDecideClaim,
  useRotateInviteCode,
  useAddCommissioner,
  useRemoveCommissioner,
  useDeleteHuddle,
  useRemoveClaim,
} from "../hooks/useHuddles";
import type { Roster, TeamUser } from "../types/fantasy";
import type {
  CommissionerSummary,
  HuddleClaimSummary,
  UserSummary,
} from "../types/huddle";

// ─── Access guard ─────────────────────────────────────────────────────────────

/**
 * Returns true if the currently-signed-in Sleeper user is the commissioner
 * (isOwner) of the currently-selected league.
 */
export function useIsCommissioner(): boolean {
  const sleeperUserId = useAppSelector(
    (state) => state.auth.user?.sleeperUserId,
  );
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);

  if (!sleeperUserId || !leagueUsers) return false;
  return (
    leagueUsers.find((u) => u.userId === sleeperUserId)?.isOwner === true
  );
}

/**
 * Returns the huddle linked to the currently-selected league, or null.
 */
function useSelectedLeagueHuddle() {
  const selectedLeagueId = useAppSelector(
    (state) => state.auth.selectedLeagueId,
  );
  const { data: huddles } = useMyHuddles();
  return useMemo(
    () => huddles?.find((h) => h.leagueId === selectedLeagueId) ?? null,
    [huddles, selectedLeagueId],
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function describeUser(u: UserSummary | null | undefined): string {
  if (!u) return "Unknown user";
  return u.username ?? u.email ?? u.id;
}

function rosterTeamName(roster: Roster, leagueUsers: TeamUser[]): string {
  const owner = roster.ownerId
    ? leagueUsers.find((u) => u.userId === roster.ownerId)
    : null;
  return owner?.teamName ?? owner?.displayName ?? `Team ${roster.rosterId}`;
}

// ─── Pending claims panel ─────────────────────────────────────────────────────

function PendingClaimsPanel({
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
  const pending = (claimsQuery.data ?? []).filter((c) => c.status === "pending");

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
            : `${pending.length} claim${pending.length !== 1 ? "s" : ""} waiting for review.`}
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
                        decide.mutate({ huddleId, claimId: claim.id, decision: "rejected" })
                      }
                      disabled={decide.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        decide.mutate({ huddleId, claimId: claim.id, decision: "approved" })
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

// ─── Invite code panel ────────────────────────────────────────────────────────

function InviteCodePanel({
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
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
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
                    rotate.mutate({ huddleId }, { onSuccess: () => setConfirming(false) })
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

// ─── Manage commissioners panel ───────────────────────────────────────────────

function ManageCommissionersPanel({
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
                      onClick={() =>
                        remove.mutate(
                          { huddleId, targetUserId: c.userId },
                          { onSuccess: () => setConfirmRemoveId(null) },
                        )
                      }
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
                  onClick={() =>
                    add.mutate(
                      { huddleId, newUserId: selectedUserId },
                      { onSuccess: () => setSelectedUserId("") },
                    )
                  }
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

// ─── Danger zone panel ────────────────────────────────────────────────────────

function DangerZonePanel({
  huddleId,
  groupName,
}: {
  huddleId: string;
  groupName: string;
}) {
  const del = useDeleteHuddle();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = confirmText.trim() === groupName && !del.isPending;

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">Danger zone</CardTitle>
        <CardDescription>
          Deleting the huddle removes all claims permanently. This cannot be
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
                onClick={() => { setConfirming(false); setConfirmText(""); }}
                disabled={del.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete}
                onClick={() =>
                  del.mutate({ huddleId }, { onSuccess: () => navigate("/leagues") })
                }
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

// ─── Coming-soon stub section ─────────────────────────────────────────────────

function StubSection({
  icon: Icon,
  title,
  description,
  tag,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  tag?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-highlight text-ink shrink-0">
              <Icon size={16} />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              {tag && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted font-sans">
                  {tag}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted font-sans border border-line rounded px-1.5 py-0.5">
            Coming soon
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[12.5px] text-muted font-sans leading-relaxed mb-3">
          {description}
        </p>
        <div className="h-14 rounded-md bg-highlight/50 border border-dashed border-line flex items-center justify-center">
          <span className="text-[11px] text-muted font-sans italic">
            Controls will appear here
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CommissionerPage() {
  const isCommissioner = useIsCommissioner();
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);

  const huddle = useSelectedLeagueHuddle();
  const huddleDetail = useHuddleDetail(huddle?.id ?? null);
  const detail = huddleDetail.data;

  // Hard redirect if a non-commissioner navigates here directly.
  if (!isCommissioner) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full bg-paper text-ink font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">

        {/* Page header */}
        <div className="mb-8 pb-5 border-b border-line">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">
            Commissioner Tools
          </p>
          <h1 className="font-serif text-3xl font-bold text-ink leading-tight">
            Control Panel
          </h1>
          <p className="mt-1.5 text-[13px] text-muted font-sans">
            Manage your league — visible only to commissioners.
          </p>
        </div>

        <div className="flex flex-col gap-5">

          {/* ── Huddle management (live) ───────────────────────────────── */}
          {huddle && detail ? (
            <>
              <PendingClaimsPanel
                huddleId={huddle.id}
                rosters={rosters ?? []}
                leagueUsers={leagueUsers ?? []}
              />
              <InviteCodePanel
                huddleId={huddle.id}
                inviteCode={detail.huddle.inviteCode}
              />
              <ManageCommissionersPanel
                huddleId={huddle.id}
                commissioners={detail.huddle.commissioners}
                claims={detail.claims}
              />
              <DangerZonePanel
                huddleId={huddle.id}
                groupName={detail.huddle.name}
              />
            </>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted">
                {huddle
                  ? "Loading huddle…"
                  : "No huddle is linked to this league yet. Create one from the Huddles page."}
              </CardContent>
            </Card>
          )}

          {/* ── League management (coming soon) ───────────────────────── */}
          <StubSection
            icon={Megaphone}
            title="Announcements"
            description="Post a message that gets pinned to the top of every member's dashboard. Use it for trade deadlines, playoff reminders, or trash talk."
            tag="League communications"
          />
          <StubSection
            icon={DollarSign}
            title="Dues Tracker"
            description="Set the buy-in amount and mark who has paid. Members can see their own status; only you see the full picture."
            tag="Finance"
          />
          <StubSection
            icon={Trophy}
            title="Payout Structure"
            description="Define how the prize pool is distributed — 1st, 2nd, 3rd place, most points, best regular-season record, or any split you like."
            tag="Finance"
          />
          <StubSection
            icon={Award}
            title="Custom Awards"
            description="Grant one-off trophies to any team: Sacko, Most Improved, Most Transactions, Lucky Schedule — anything your league cares about."
            tag="Awards"
          />

        </div>
      </div>
    </div>
  );
}
