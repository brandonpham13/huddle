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
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import {
  useMyHuddles,
  useHuddleDetail,
  useSubmitClaim,
  useRemoveClaim,
  usePayouts,
} from "../hooks/useHuddles";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import type { Roster, TeamUser } from "../types/fantasy";
import type { HuddleClaimSummary } from "../types/huddle";

// ─── Shared primitives (mirrors CommissionerPage) ─────────────────────────────

function Panel({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-5 flex flex-col gap-4 bg-paper ${
        danger ? "border-red-300" : "border-line"
      }`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-line pb-3">
      <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[12.5px] text-muted font-sans leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  danger,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md border text-xs font-medium font-sans transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : "border-line text-ink hover:bg-highlight"
        } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function BtnPrimary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

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

// ─── Payout structure read-only ────────────────────────────────────────────────

function PayoutsReadOnly({ huddleId }: { huddleId: string }) {
  const { data: entries } = usePayouts(huddleId);
  if (!entries || entries.length === 0) return null;

  const totalCents = entries.reduce((s, e) => s + e.amount, 0);
  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <Panel>
      <PanelHeader
        title="Payout Structure"
        description="How the prize pool is distributed this season."
      />
      <div className="flex flex-col divide-y divide-line">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between py-2.5">
            <span className="text-[13px] font-sans text-ink">{e.label}</span>
            <span className="text-[13px] font-mono font-semibold text-ink">
              {fmt(e.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-line">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted font-sans">
          Total pool
        </span>
        <span className="text-[13px] font-mono font-semibold text-ink">
          {fmt(totalCents)}
        </span>
      </div>
    </Panel>
  );
}

// ─── Teams table ───────────────────────────────────────────────────────────────

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
    <Panel>
      <PanelHeader
        title="Teams"
        description="Claim your team so the dashboard knows who you are. One claim per member — pending claims need commissioner approval."
      />

      <div className="flex flex-col divide-y divide-line">
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
            <div key={roster.rosterId}>
              <div className="flex items-center justify-between py-2.5 gap-3">
                {/* Team name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] font-mono text-muted w-5 shrink-0">
                    {roster.rosterId}
                  </span>
                  <span className="text-[13px] font-medium text-ink font-sans truncate">
                    {teamName}
                  </span>
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {claim ? (
                    <>
                      <span className="text-[12px] text-muted font-sans">
                        <span className="font-semibold text-ink">{describeUser(claim.user)}</span>
                      </span>
                      {/* Claim owner can unlink themselves; commissioner can unlink anyone. */}
                      {(isMyTeam || isCommissioner) &&
                        confirmRemoveClaimId !== claim.id ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Btn
                                danger
                                disabled={selfUnlinkBlocked}
                                onClick={() => setConfirmRemoveClaimId(claim.id)}
                              >
                                Unlink
                              </Btn>
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
                        <div className="flex gap-1.5">
                          <Btn onClick={() => setConfirmRemoveClaimId(null)}>Cancel</Btn>
                          <Btn
                            danger
                            disabled={removeClaim.isPending}
                            onClick={() =>
                              removeClaim.mutate(
                                { huddleId, claimId: claim.id, isCommissioner },
                                { onSuccess: () => setConfirmRemoveClaimId(null) },
                              )
                            }
                          >
                            Confirm
                          </Btn>
                        </div>
                      ) : null}
                    </>
                  ) : pendingClaim ? (
                    <>
                      <span className="text-[11px] font-sans text-muted">
                        {describeUser(pendingClaim.user)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-semibold font-sans">
                        Pending
                      </span>
                      {/* Claimant can withdraw their own pending claim; commissioner can remove any. */}
                      {(isMyPendingClaim || isCommissioner) &&
                        confirmRemoveClaimId !== pendingClaim.id ? (
                        <Btn
                          danger
                          onClick={() => setConfirmRemoveClaimId(pendingClaim.id)}
                        >
                          {isMyPendingClaim ? "Withdraw" : "Remove"}
                        </Btn>
                      ) : (isMyPendingClaim || isCommissioner) &&
                        confirmRemoveClaimId === pendingClaim.id ? (
                        <div className="flex gap-1.5">
                          <Btn onClick={() => setConfirmRemoveClaimId(null)}>Cancel</Btn>
                          <Btn
                            danger
                            disabled={removeClaim.isPending}
                            onClick={() =>
                              removeClaim.mutate(
                                { huddleId, claimId: pendingClaim.id, isCommissioner },
                                { onSuccess: () => setConfirmRemoveClaimId(null) },
                              )
                            }
                          >
                            Confirm
                          </Btn>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-muted font-sans">Unclaimed</span>
                      {canClaimNew && !isExpanding && (
                        <Btn
                          onClick={() => {
                            setClaimingRosterId(roster.rosterId);
                            setMessage("");
                          }}
                        >
                          Claim
                        </Btn>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Inline claim form */}
              {isExpanding && (
                <div className="pb-3 pl-7 flex flex-col gap-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink resize-none"
                    placeholder="Message for the commissioner (optional)"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Btn
                      onClick={() => setClaimingRosterId(null)}
                      disabled={submit.isPending}
                    >
                      Cancel
                    </Btn>
                    <BtnPrimary
                      disabled={submit.isPending}
                      onClick={() =>
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
                        )
                      }
                    >
                      {submit.isPending ? "Submitting…" : "Submit claim"}
                    </BtnPrimary>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-[13px] text-muted font-sans py-3">
            No rosters loaded yet.
          </p>
        )}
      </div>

      {myClaim?.status === "pending" && (
        <p className="text-[12px] text-amber-600 font-sans">
          Your claim for roster #{myClaim.rosterId} is pending approval.
        </p>
      )}
      {(submit.error || removeClaim.error) && (
        <p className="text-[11.5px] text-red-600 font-sans">
          {((submit.error ?? removeClaim.error) as Error).message}
        </p>
      )}
    </Panel>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LeagueSettingsPage() {
  const { userId } = useAuth();
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);

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
          <h1 className="font-serif text-3xl font-bold text-ink leading-tight">
            Settings
          </h1>
          <p className="mt-1.5 text-[13px] text-muted font-sans">
            Manage your team claim and league preferences.
          </p>
        </div>

        <div className="flex flex-col gap-5">

          {/* Teams table */}
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
            <div className="border border-line rounded-lg p-6 text-center text-[13px] text-muted font-sans bg-paper">
              {huddle
                ? "Loading…"
                : "No huddle is linked to this league. Ask your commissioner to set one up."}
            </div>
          )}

          {/* Payout structure — read-only for members */}
          {huddle && <PayoutsReadOnly huddleId={huddle.id} />}

          {/* Preferences stub */}
          <div className="border border-line rounded-lg p-5 flex flex-col gap-3 bg-paper">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">
                  Preferences
                </h2>
                <p className="mt-1 text-[12.5px] text-muted font-sans leading-relaxed">
                  Notification settings, display preferences, and other
                  per-league options will live here.
                </p>
              </div>
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted font-sans border border-line rounded px-1.5 py-0.5">
                Coming soon
              </span>
            </div>
            <div className="h-14 rounded-md bg-highlight/50 border border-dashed border-line flex items-center justify-center">
              <span className="text-[11px] text-muted font-sans italic">
                Settings will appear here
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
