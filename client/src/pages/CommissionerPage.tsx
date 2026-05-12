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
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
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

// ─── Shared primitives ───────────────────────────────────────────────────────

/** Consistent section card wrapper. */
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

/** Section heading inside a Panel. */
function PanelHeader({
  title,
  description,
  titleClass,
}: {
  title: string;
  description?: string;
  titleClass?: string;
}) {
  return (
    <div className="border-b border-line pb-3">
      <h2 className={`font-serif font-semibold text-[15px] leading-tight ${titleClass ?? "text-ink"}`}>
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

/** Small action button — outline style. */
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

/** Primary (filled) action button. */
function BtnPrimary({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium font-sans transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-ink text-paper hover:opacity-90"
        }`}
    >
      {children}
    </button>
  );
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
    <Panel>
      <PanelHeader
        title="Pending claims"
        description={
          pending.length === 0
            ? "No pending requests."
            : `${pending.length} claim${pending.length !== 1 ? "s" : ""} waiting for review.`
        }
      />
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map((claim) => (
            <div
              key={claim.id}
              className="border border-line rounded-md p-3 bg-highlight/40 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink font-sans">
                  {describeUser(claim.user)}
                </p>
                <p className="text-[11.5px] text-muted font-sans mt-0.5">
                  requesting{" "}
                  <span className="font-medium text-ink">
                    {teamNameForRoster(claim.rosterId)}
                  </span>
                  {claim.user?.email && claim.user.username
                    ? ` · ${claim.user.email}`
                    : ""}
                </p>
                {claim.message && (
                  <p className="text-[11.5px] text-muted font-sans mt-1 italic">
                    "{claim.message}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Btn
                  onClick={() =>
                    decide.mutate({ huddleId, claimId: claim.id, decision: "rejected" })
                  }
                  disabled={decide.isPending}
                >
                  Reject
                </Btn>
                <BtnPrimary
                  onClick={() =>
                    decide.mutate({ huddleId, claimId: claim.id, decision: "approved" })
                  }
                  disabled={decide.isPending}
                >
                  Approve
                </BtnPrimary>
              </div>
            </div>
          ))}
        </div>
      )}
      {decide.isError && (
        <p className="text-[11.5px] text-red-600 font-sans">
          {(decide.error as Error).message}
        </p>
      )}
    </Panel>
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
    <Panel>
      <PanelHeader
        title="Invite code"
        description="Share this with members so they can join and claim a team. Rotate it to invalidate the old code immediately."
      />
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center bg-highlight border border-line rounded-md py-2.5 font-mono text-2xl font-bold tracking-widest text-ink">
          {displayCode ?? "———"}
        </div>
        <Btn onClick={handleCopy} className="px-4 py-2.5">
          {copied ? "Copied!" : "Copy"}
        </Btn>
      </div>
      {!confirming ? (
        <div>
          <Btn onClick={() => setConfirming(true)}>Rotate code…</Btn>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex flex-col gap-2">
          <p className="text-[12px] text-amber-800 dark:text-amber-300 font-sans">
            The old code stops working immediately. Continue?
          </p>
          <div className="flex gap-2">
            <Btn onClick={() => setConfirming(false)} disabled={rotate.isPending}>
              Cancel
            </Btn>
            <BtnPrimary
              onClick={() =>
                rotate.mutate({ huddleId }, { onSuccess: () => setConfirming(false) })
              }
              disabled={rotate.isPending}
            >
              {rotate.isPending ? "Rotating…" : "Yes, rotate"}
            </BtnPrimary>
          </div>
        </div>
      )}
      {rotate.isError && (
        <p className="text-[11.5px] text-red-600 font-sans">
          {(rotate.error as Error).message}
        </p>
      )}
    </Panel>
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
    <Panel>
      <PanelHeader
        title="Commissioners"
        description="Co-commissioners can approve claims, rotate the invite code, and manage the huddle. There must always be at least one."
      />

      <div className="flex flex-col divide-y divide-line">
        {commissioners.map((c) => (
          <div key={c.userId} className="flex items-center justify-between py-2.5">
            <span className="text-[13px] font-sans text-ink">{describeUser(c.user)}</span>
            {commissioners.length > 1 && confirmRemoveId !== c.userId ? (
              <Btn danger onClick={() => setConfirmRemoveId(c.userId)}>
                Remove
              </Btn>
            ) : confirmRemoveId === c.userId ? (
              <div className="flex gap-2">
                <Btn onClick={() => setConfirmRemoveId(null)}>Cancel</Btn>
                <Btn
                  danger
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(
                      { huddleId, targetUserId: c.userId },
                      { onSuccess: () => setConfirmRemoveId(null) },
                    )
                  }
                >
                  Confirm
                </Btn>
              </div>
            ) : (
              <span className="text-[11px] text-muted font-sans">last commish</span>
            )}
          </div>
        ))}
      </div>

      {eligible.length > 0 && (
        <div className="pt-1 border-t border-line flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted font-sans">
            Add co-commissioner
          </p>
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 text-[13px] font-sans border border-line rounded-md px-2 py-1.5 bg-paper text-ink"
            >
              <option value="">Select a member…</option>
              {eligible.map((c) => (
                <option key={c.id} value={c.user?.id ?? ""}>
                  {describeUser(c.user)}
                </option>
              ))}
            </select>
            <BtnPrimary
              disabled={!selectedUserId || add.isPending}
              onClick={() =>
                add.mutate(
                  { huddleId, newUserId: selectedUserId },
                  { onSuccess: () => setSelectedUserId("") },
                )
              }
            >
              {add.isPending ? "Adding…" : "Add"}
            </BtnPrimary>
          </div>
        </div>
      )}

      {(add.isError || remove.isError) && (
        <p className="text-[11.5px] text-red-600 font-sans">
          {((add.error ?? remove.error) as Error).message}
        </p>
      )}
    </Panel>
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
    <Panel danger>
      <PanelHeader
        title="Danger zone"
        description="Deleting the huddle removes all claims permanently. This cannot be undone."
        titleClass="text-red-600"
      />
      {!confirming ? (
        <div>
          <BtnPrimary danger onClick={() => setConfirming(true)}>
            Delete huddle
          </BtnPrimary>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink font-sans">
            Type{" "}
            <span className="font-mono font-semibold">{groupName}</span>{" "}
            to confirm:
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
            placeholder={groupName}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Btn
              onClick={() => { setConfirming(false); setConfirmText(""); }}
              disabled={del.isPending}
            >
              Cancel
            </Btn>
            <BtnPrimary danger disabled={!canDelete} onClick={() =>
              del.mutate({ huddleId }, { onSuccess: () => navigate("/huddles") })
            }>
              {del.isPending ? "Deleting…" : "Delete forever"}
            </BtnPrimary>
          </div>
          {del.isError && (
            <p className="text-[11.5px] text-red-600 font-sans">
              {(del.error as Error).message}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}


// ─── Announcements panel ──────────────────────────────────────────────────────

function AnnouncementsPanel({ huddleId }: { huddleId: string }) {
  const { data: announcements } = useAnnouncements(huddleId);
  const create = useCreateAnnouncement();
  const del = useDeleteAnnouncement();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handlePost = () => {
    if (!title.trim() || !body.trim()) return;
    create.mutate(
      { huddleId, title: title.trim(), body: body.trim() },
      { onSuccess: () => { setTitle(""); setBody(""); } },
    );
  };

  return (
    <Panel>
      <PanelHeader
        title="Announcements"
        description="Post a message pinned to every member's dashboard."
      />
      <div className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Title"
          className="text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Write your announcement…"
          className="text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink resize-none"
        />
        <div className="flex items-center justify-end gap-3">
          {create.isError && (
            <p className="text-[11.5px] text-red-600 font-sans flex-1">
              {(create.error as Error).message}
            </p>
          )}
          <BtnPrimary
            onClick={handlePost}
            disabled={create.isPending || !title.trim() || !body.trim()}
          >
            {create.isPending ? "Posting…" : "Post announcement"}
          </BtnPrimary>
        </div>
      </div>
      {announcements && announcements.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold font-serif text-ink leading-tight">
                  {a.title}
                </p>
                <p className="text-[12px] text-muted font-sans mt-0.5 line-clamp-2">
                  {a.body}
                </p>
                <p className="text-[10.5px] text-muted font-sans mt-1">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              {confirmDeleteId !== a.id ? (
                <Btn danger onClick={() => setConfirmDeleteId(a.id)} className="shrink-0">
                  Delete
                </Btn>
              ) : (
                <div className="flex gap-1.5 shrink-0">
                  <Btn onClick={() => setConfirmDeleteId(null)}>Cancel</Btn>
                  <Btn
                    danger
                    disabled={del.isPending}
                    onClick={() =>
                      del.mutate(
                        { huddleId, announcementId: a.id },
                        { onSuccess: () => setConfirmDeleteId(null) },
                      )
                    }
                  >
                    Confirm
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
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
    <div className="border border-line rounded-lg p-5 flex flex-col gap-3 bg-paper">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-highlight text-ink shrink-0">
            <Icon size={16} />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">
              {title}
            </h2>
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
      <p className="text-[12.5px] text-muted font-sans leading-relaxed">
        {description}
      </p>
      <div className="h-14 rounded-md bg-highlight/50 border border-dashed border-line flex items-center justify-center">
        <span className="text-[11px] text-muted font-sans italic">
          Controls will appear here
        </span>
      </div>
    </div>
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

          {/* ── League management (coming soon) ───────────────────────── */}
          {huddle ? (
            <AnnouncementsPanel huddleId={huddle.id} />
          ) : (
            <StubSection
              icon={Megaphone}
              title="Announcements"
              description="Post a message that gets pinned to the top of every member's dashboard. Use it for trade deadlines, playoff reminders, or trash talk."
              tag="League communications"
            />
          )}
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
            <div className="border border-line rounded-lg p-6 text-center text-[13px] text-muted font-sans bg-paper">
              {huddle
                ? "Loading huddle…"
                : "No huddle is linked to this league yet. Create one from the Huddles page."}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
