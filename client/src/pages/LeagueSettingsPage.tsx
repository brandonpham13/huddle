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
  useHuddleDetail,
  useSubmitClaim,
  useRemoveClaim,
  useAwards,
  usePayouts,
  useAwardIcons,
  useSelectedLeagueHuddle,
} from "../hooks/useHuddles";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import type { Roster, TeamUser } from "../types/fantasy";
import type { HuddleAward, HuddleClaimSummary } from "../types/huddle";

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

/** Inline SVG glyph for awards in League Settings — full set matching CommissionerPage. */
function SettingsGlyphSvg({ kind, color, iconSvg }: { kind: string; color: string; iconSvg?: string }) {
  if (kind.startsWith("icon:") && iconSvg) {
    return (
      <svg width={28} height={28} viewBox="0 0 36 40" className="mb-1"
        style={{ color }}
        dangerouslySetInnerHTML={{ __html: iconSvg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "") }}
      />
    );
  }
  const s = { stroke: color, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const vb = "0 0 36 40"; const sz = 28;
  if (kind === "cup")    return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} d="M8 4 H28 V14 C28 22 24 27 18 27 C12 27 8 22 8 14 Z" fillOpacity={0.15} fill={color} /><path {...s} d="M8 8 H3 C3 14 6 17 9 17" /><path {...s} d="M28 8 H33 C33 14 30 17 27 17" /><path {...s} d="M14 27 V32 H22 V27" /><path {...s} d="M10 36 H26" strokeWidth={2.2} /></svg>;
  if (kind === "crown")  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M4 28 L4 32 H32 V28 L28 14 L18 22 L8 14 Z" /><circle cx="4" cy="13" r="2.5" fill={color} /><circle cx="18" cy="9" r="2.5" fill={color} /><circle cx="32" cy="13" r="2.5" fill={color} /></svg>;
  if (kind === "medal")  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} d="M12 2 L8 14 M24 2 L28 14" /><circle cx="18" cy="24" r="11" {...s} fillOpacity={0.15} fill={color} /><circle cx="18" cy="24" r="6" {...s} /></svg>;
  if (kind === "ribbon") return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><circle cx="18" cy="14" r="9" {...s} fillOpacity={0.15} fill={color} /><path {...s} d="M11 21 L8 36 L14 32 L18 36 L22 32 L28 36 L25 21" /></svg>;
  if (kind === "star")   return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M18 4 L22 14 L33 15 L24 22 L27 33 L18 27 L9 33 L12 22 L3 15 L14 14 Z" /></svg>;
  if (kind === "bolt")   return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M22 2 L10 21 H18 L14 38 L28 17 H20 Z" /></svg>;
  if (kind === "fire")   return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M18 2 C18 2 26 10 26 20 C26 28 22 34 18 36 C14 34 10 28 10 20 C10 10 18 2 18 2 Z" /><path {...s} d="M18 14 C18 14 22 19 22 24 C22 28 20 31 18 32 C16 31 14 28 14 24 C14 19 18 14 18 14 Z" /></svg>;
  if (kind === "rocket") return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M18 2 C24 2 28 8 28 16 L28 26 L18 30 L8 26 L8 16 C8 8 12 2 18 2 Z" /><path {...s} d="M13 8 Q18 3 23 8" /><path {...s} d="M8 22 L4 30 L8 28" /><path {...s} d="M28 22 L32 30 L28 28" /><path {...s} d="M14 30 Q18 36 22 30" /></svg>;
  if (kind === "skull")  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M6 20 C6 10 12 4 18 4 C24 4 30 10 30 20 L30 28 L24 28 L24 32 L12 32 L12 28 L6 28 Z" /><circle cx="13" cy="19" r="3.5" fill={color} /><circle cx="23" cy="19" r="3.5" fill={color} /><path {...s} d="M17 24 L19 24" /></svg>;
  if (kind === "trash")  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} d="M8 10 H28" strokeWidth={2} /><path {...s} d="M14 10 V6 H22 V10" /><path {...s} fillOpacity={0.12} fill={color} d="M10 12 L11 36 H25 L26 12 Z" /><path {...s} d="M15 16 L15.5 32 M18 16 V32 M21 16 L20.5 32" /></svg>;
  if (kind === "poop")   return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} d="M18 4 C21 4 23 6 22 9 C21 11 18 11 17 13 C16 15 18 16 20 15 C23 14 25 16 24 19 C23 22 20 22 18 22" /><path {...s} fillOpacity={0.15} fill={color} d="M8 30 C8 24 12 22 18 22 C24 22 28 24 28 30 C28 34 24 36 18 36 C12 36 8 34 8 30 Z" /><circle cx="15" cy="29" r="1.2" fill={color} /><circle cx="21" cy="29" r="1.2" fill={color} /><path {...s} d="M14 33 Q18 36 22 33" strokeWidth={1.2} /></svg>;
  if (kind === "ghost")  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M6 36 L6 18 C6 8 30 8 30 18 L30 36 L26 32 L22 36 L18 32 L14 36 L10 32 Z" /><circle cx="14" cy="20" r="2.5" fill={color} /><circle cx="22" cy="20" r="2.5" fill={color} /></svg>;
  if (kind === "broken") return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.15} fill={color} d="M18 34 C18 34 4 24 4 14 C4 8 8 4 13 4 C15.5 4 17.5 5.5 18 7 C18.5 5.5 20.5 4 23 4 C28 4 32 8 32 14 C32 24 18 34 18 34 Z" /><path stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" d="M18 8 L15 16 L20 18 L16 26" /></svg>;
  if (kind === "deal")   return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><path {...s} fillOpacity={0.1} fill={color} d="M4 22 C4 18 7 16 10 16 L18 16 L18 28 L10 28 C7 28 4 26 4 22 Z" /><path {...s} fillOpacity={0.1} fill={color} d="M32 22 C32 18 29 16 26 16 L18 16 L18 28 L26 28 C29 28 32 26 32 22 Z" /><path {...s} d="M10 16 L10 10 M13 16 L13 8 M16 16 L16 9" /><path {...s} d="M26 16 L26 10 M23 16 L23 8 M20 16 L20 9" /></svg>;
  return <svg width={sz} height={sz} viewBox={vb} className="mb-1"><circle cx="18" cy="20" r="12" {...s} fillOpacity={0.15} fill={color} /><path {...s} d="M18 14 V21 M18 25 V26" /></svg>;
}

/** Read-only display of all huddle awards — visible to all members. */
function AwardsSection({
  huddleId,
  rosters,
  leagueUsers,
  iconMap,
}: {
  huddleId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
  iconMap: Map<string, string>;
}) {
  const { data: awards } = useAwards(huddleId);

  // Don't render if there are no awards yet
  if (!awards || awards.length === 0) return null;

  function teamNameForRosterId(id: number): string {
    const r = rosters.find((x) => x.rosterId === id);
    if (!r) return `Team ${id}`;
    return rosterTeamName(r, leagueUsers);
  }

  return (
    <Panel>
      <PanelHeader
        title="Awards"
        description="Custom awards granted by your commissioner."
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {awards.map((a: HuddleAward) => (
          <div
            key={a.id}
            className="relative flex flex-col p-3.5 border"
            style={{ borderColor: a.color + "66", backgroundColor: a.color + "11" }}
          >
            {a.season && (
              <div
                className="absolute top-0 right-0 px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wider text-white"
                style={{ backgroundColor: a.color }}
              >
                {a.season}
              </div>
            )}
            <SettingsGlyphSvg kind={a.glyph} color={a.color} iconSvg={a.glyph.startsWith("icon:") ? iconMap.get(a.glyph.replace("icon:", "")) : undefined} />
            <div className="font-serif italic font-bold text-[14px] text-ink leading-tight tracking-tight mt-1">
              {a.title}
            </div>
            <div className="font-serif text-xs text-body mt-1 leading-snug">
              {teamNameForRosterId(a.rosterId)}
            </div>
            <div className="flex-1" />
            <div
              className="mt-2 pt-1.5 border-t border-dotted border-line text-[9.5px] uppercase tracking-wider font-sans font-semibold"
              style={{ color: a.color }}
            >
              Commissioner
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
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

  const huddle = useSelectedLeagueHuddle();
  const huddleDetail = useHuddleDetail(huddle?.id ?? null);
  const detail = huddleDetail.data;
  const isCommissioner = !!detail?.huddle.isCommissioner;
  const { data: iconData = [] } = useAwardIcons();
  const settingsIconMap = useMemo(() => new Map(iconData.map((ic) => [ic.id, ic.svg])), [iconData]);

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

          {/* Awards — read-only, only shown when awards exist */}
          {huddle && rosters && leagueUsers && (
            <AwardsSection
              huddleId={huddle.id}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
              iconMap={settingsIconMap}
            />
          )}

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
