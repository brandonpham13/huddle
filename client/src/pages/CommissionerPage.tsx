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
import { Megaphone, DollarSign, Trophy, Award, Plus, Trash2 } from "lucide-react";
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
  useDues,
  useSetDuesConfig,
  useSetDuesPaid,
  useAwards,
  useCreateAward,
  useUpdateAward,
  useDeleteAward,
  useActiveTrophies,
  useSetTrophyEnabled,
  useAwardIcons,
  useSelectedLeagueHuddle,
  type AwardIcon,
  usePayouts,
  useSetPayouts,
} from "../hooks/useHuddles";
import type { Roster, TeamUser } from "../types/fantasy";
import type {
  CommissionerSummary,
  HuddleClaimSummary,
  HuddleAward,
  UserSummary,
  ActiveTrophies,
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

// ─── Dues tracker panel ──────────────────────────────────────────────────────

function DuesTrackerPanel({
  huddleId,
  rosters,
  leagueUsers,
}: {
  huddleId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
}) {
  const { data: duesData } = useDues(huddleId);
  const setConfig = useSetDuesConfig();
  const setPaid = useSetDuesPaid();

  // Local config form state, seeded from saved data
  const [amount, setAmount] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [configInitialized, setConfigInitialized] = useState(false);

  useMemo(() => {
    if (duesData?.config && !configInitialized) {
      setAmount(((duesData.config.amount ?? 0) / 100).toFixed(2));
      setSeason(duesData.config.season ?? "");
      setNote(duesData.config.note ?? "");
      setConfigInitialized(true);
    }
  }, [duesData?.config, configInitialized]);

  const paidRosterIds = useMemo(
    () => new Set((duesData?.payments ?? []).filter((p) => p.paidAt).map((p) => p.rosterId)),
    [duesData?.payments],
  );

  const paidCount = paidRosterIds.size;
  const totalCount = rosters.length;
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const totalCollected = paidCount * amountCents;
  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <Panel>
      <PanelHeader
        title="Dues Tracker"
        description="Set the buy-in amount and mark who has paid."
      />

      {/* Config form */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted font-sans">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-[13px] font-sans border border-line rounded-md pl-6 pr-3 py-1.5 bg-paper text-ink"
            />
          </div>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="Season (e.g. 2024)"
            maxLength={20}
            className="flex-1 text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          maxLength={200}
          className="text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
        />
        <div className="flex items-center justify-end gap-3">
          {setConfig.isError && (
            <p className="text-[11.5px] text-red-600 font-sans flex-1">
              {(setConfig.error as Error).message}
            </p>
          )}
          {setConfig.isSuccess && (
            <p className="text-[11.5px] text-accent font-sans">Saved!</p>
          )}
          <BtnPrimary
            onClick={() =>
              setConfig.mutate({ huddleId, amount: amountCents, season: season || null, note: note || null })
            }
            disabled={setConfig.isPending}
          >
            {setConfig.isPending ? "Saving…" : "Save config"}
          </BtnPrimary>
        </div>
      </div>

      {/* Payment roster */}
      {rosters.length > 0 && (
        <div className="flex flex-col divide-y divide-line border-t border-line pt-2">
          {[...rosters].sort((a, b) => a.rosterId - b.rosterId).map((r) => {
            const user = r.ownerId ? leagueUsers.find((u) => u.userId === r.ownerId) : null;
            const name = user?.teamName ?? user?.displayName ?? `Team ${r.rosterId}`;
            const paid = paidRosterIds.has(r.rosterId);
            return (
              <div key={r.rosterId} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-[13px] font-sans text-ink truncate">{name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {paid ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
                      ✓ Paid
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted font-sans">Unpaid</span>
                  )}
                  <Btn
                    onClick={() =>
                      setPaid.mutate({ huddleId, rosterId: r.rosterId, paid: !paid })
                    }
                    disabled={setPaid.isPending}
                  >
                    {paid ? "Mark unpaid" : "Mark paid"}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="flex justify-between items-center text-[12px] font-sans border-t border-line pt-3">
        <span className="text-muted">
          {paidCount} of {totalCount} paid
        </span>
        <span className="font-semibold text-ink">
          {fmt(totalCollected)} collected{amountCents > 0 ? ` of ${fmt(totalCount * amountCents)}` : ""}
        </span>
      </div>
    </Panel>
  );
}


/** Preset colour swatches commissioners can choose from. */

/** Preset colour swatches commissioners can choose from. */
// ── Award glyph definitions (mirrors TrophyGlyph kinds) ─────────────────────

const AWARD_GLYPHS: Array<{ kind: string; label: string }> = [
  { kind: "cup",    label: "Cup"       },
  { kind: "medal",  label: "Medal"     },
  { kind: "ribbon", label: "Ribbon"    },
  { kind: "star",   label: "Star"      },
  { kind: "bolt",   label: "Lightning" },
  { kind: "trash",  label: "Trash Can" },
];

/**
 * Inline SVG glyph — mirrors TrophyGlyph in TeamPage so commissioner awards
 * and stat trophies use identical icons.
 */
function GlyphSvg({
  kind,
  size = 36,
  iconSvg,
}: {
  kind: string;
  size?: number;
  /** Raw SVG string for icon: prefixed kinds. */
  iconSvg?: string;
}) {
  // Custom icon file — inject the SVG with currentColor applied
  if (kind.startsWith("icon:") && iconSvg) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 40"
        dangerouslySetInnerHTML={{ __html: iconSvg
          .replace(/<svg[^>]*>/, "")  // strip outer <svg> tag
          .replace(/<\/svg>/, "")    // strip closing tag
        }}
      />
    );
  }
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.4,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const vb = "0 0 36 40";

  // ── Classic trophies ───────────────────────────────────────────────────────
  if (kind === "cup")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} d="M8 4 H28 V14 C28 22 24 27 18 27 C12 27 8 22 8 14 Z" fillOpacity={0.15} fill="currentColor" />
        <path {...stroke} d="M8 8 H3 C3 14 6 17 9 17" />
        <path {...stroke} d="M28 8 H33 C33 14 30 17 27 17" />
        <path {...stroke} d="M14 27 V32 H22 V27" />
        <path {...stroke} d="M10 36 H26" strokeWidth={2.2} />
      </svg>
    );
  if (kind === "crown")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M4 28 L4 32 H32 V28 L28 14 L18 22 L8 14 Z" />
        <circle cx="4"  cy="13" r="2.5" fill="currentColor" />
        <circle cx="18" cy="9"  r="2.5" fill="currentColor" />
        <circle cx="32" cy="13" r="2.5" fill="currentColor" />
      </svg>
    );
  if (kind === "medal")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} d="M12 2 L8 14 M24 2 L28 14" />
        <circle cx="18" cy="24" r="11" {...stroke} fillOpacity={0.15} fill="currentColor" />
        <circle cx="18" cy="24" r="6" {...stroke} />
      </svg>
    );
  if (kind === "ribbon")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <circle cx="18" cy="14" r="9" {...stroke} fillOpacity={0.15} fill="currentColor" />
        <path {...stroke} d="M11 21 L8 36 L14 32 L18 36 L22 32 L28 36 L25 21" />
      </svg>
    );
  if (kind === "star")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M18 4 L22 14 L33 15 L24 22 L27 33 L18 27 L9 33 L12 22 L3 15 L14 14 Z" />
      </svg>
    );

  // ── Positive superlatives ──────────────────────────────────────────────────
  if (kind === "bolt")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M22 2 L10 21 H18 L14 38 L28 17 H20 Z" />
      </svg>
    );
  if (kind === "fire")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* outer flame */}
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M18 2 C18 2 26 10 26 20 C26 28 22 34 18 36 C14 34 10 28 10 20 C10 10 18 2 18 2 Z" />
        {/* inner flame */}
        <path {...stroke}
          d="M18 14 C18 14 22 19 22 24 C22 28 20 31 18 32 C16 31 14 28 14 24 C14 19 18 14 18 14 Z" />
      </svg>
    );
  if (kind === "rocket")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* body */}
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M18 2 C24 2 28 8 28 16 L28 26 L18 30 L8 26 L8 16 C8 8 12 2 18 2 Z" />
        {/* nose cone */}
        <path {...stroke} d="M13 8 Q18 3 23 8" />
        {/* fins */}
        <path {...stroke} d="M8 22 L4 30 L8 28" />
        <path {...stroke} d="M28 22 L32 30 L28 28" />
        {/* exhaust */}
        <path {...stroke} d="M14 30 Q18 36 22 30" />
      </svg>
    );

  // ── Funny / shame superlatives ─────────────────────────────────────────────
  if (kind === "skull")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* cranium */}
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M6 20 C6 10 12 4 18 4 C24 4 30 10 30 20 L30 28 L24 28 L24 32 L12 32 L12 28 L6 28 Z" />
        {/* eye sockets */}
        <circle cx="13" cy="19" r="3.5" fill="currentColor" />
        <circle cx="23" cy="19" r="3.5" fill="currentColor" />
        {/* nose */}
        <path {...stroke} d="M17 24 L19 24" />
      </svg>
    );
  if (kind === "trash")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* lid */}
        <path {...stroke} d="M8 10 H28" strokeWidth={2} />
        <path {...stroke} d="M14 10 V6 H22 V10" />
        {/* body */}
        <path {...stroke} fillOpacity={0.12} fill="currentColor"
          d="M10 12 L11 36 H25 L26 12 Z" />
        {/* lines */}
        <path {...stroke} d="M15 16 L15.5 32 M18 16 V32 M21 16 L20.5 32" />
      </svg>
    );
  if (kind === "poop")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* swirl top */}
        <path {...stroke}
          d="M18 4 C21 4 23 6 22 9 C21 11 18 11 17 13 C16 15 18 16 20 15 C23 14 25 16 24 19 C23 22 20 22 18 22" />
        {/* base mound */}
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M8 30 C8 24 12 22 18 22 C24 22 28 24 28 30 C28 34 24 36 18 36 C12 36 8 34 8 30 Z" />
        {/* eyes */}
        <circle cx="15" cy="29" r="1.2" fill="currentColor" />
        <circle cx="21" cy="29" r="1.2" fill="currentColor" />
        {/* smile */}
        <path {...stroke} d="M14 33 Q18 36 22 33" strokeWidth={1.2} />
      </svg>
    );
  if (kind === "ghost")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* body */}
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M6 36 L6 18 C6 8 30 8 30 18 L30 36 L26 32 L22 36 L18 32 L14 36 L10 32 Z" />
        {/* eyes */}
        <circle cx="14" cy="20" r="2.5" fill="currentColor" />
        <circle cx="22" cy="20" r="2.5" fill="currentColor" />
      </svg>
    );
  if (kind === "broken")
    return (
      <svg width={size} height={size} viewBox={vb}>
        <path {...stroke} fillOpacity={0.15} fill="currentColor"
          d="M18 34 C18 34 4 24 4 14 C4 8 8 4 13 4 C15.5 4 17.5 5.5 18 7 C18.5 5.5 20.5 4 23 4 C28 4 32 8 32 14 C32 24 18 34 18 34 Z" />
        {/* crack */}
        <path stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"
          fill="none" d="M18 8 L15 16 L20 18 L16 26" />
      </svg>
    );
  if (kind === "deal")
    return (
      <svg width={size} height={size} viewBox={vb}>
        {/* left hand */}
        <path {...stroke} fillOpacity={0.1} fill="currentColor"
          d="M4 22 C4 18 7 16 10 16 L18 16 L18 28 L10 28 C7 28 4 26 4 22 Z" />
        {/* right hand */}
        <path {...stroke} fillOpacity={0.1} fill="currentColor"
          d="M32 22 C32 18 29 16 26 16 L18 16 L18 28 L26 28 C29 28 32 26 32 22 Z" />
        {/* fingers left */}
        <path {...stroke} d="M10 16 L10 10 M13 16 L13 8 M16 16 L16 9" />
        {/* fingers right */}
        <path {...stroke} d="M26 16 L26 10 M23 16 L23 8 M20 16 L20 9" />
      </svg>
    );

  // fallback
  return (
    <svg width={size} height={size} viewBox={vb}>
      <circle cx="18" cy="20" r="12" {...stroke} fillOpacity={0.15} fill="currentColor" />
      <path {...stroke} d="M18 14 V21 M18 25 V26" />
    </svg>
  );
}

const AWARD_COLORS = [
  { hex: "#ef4444", label: "Red" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#8b5cf6", label: "Purple" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#6b7280", label: "Gray" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#14b8a6", label: "Teal" },
];

/** A single award displayed as a colour-coded badge with edit + delete buttons. */
function AwardBadge({
  award,
  teamName,
  onEdit,
  onDelete,
  deleting,
  iconSvg,
}: {
  award: HuddleAward;
  teamName: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  iconSvg?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-line rounded-md p-3 bg-paper">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-8 h-8 flex items-center justify-center rounded-md shrink-0"
          style={{ backgroundColor: award.color + "22", color: award.color }}
        >
          <GlyphSvg kind={award.glyph} size={20} iconSvg={iconSvg} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink font-sans leading-tight">
            {award.title}
          </p>
          <p className="text-[11px] text-muted font-sans">
            {teamName}
            {award.season ? ` · ${award.season}` : ""}
          </p>
          {award.description && (
            <p className="text-[11px] text-muted font-sans italic truncate">
              {award.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Btn onClick={onEdit}>Edit</Btn>
        <Btn danger disabled={deleting} onClick={onDelete}>Remove</Btn>
      </div>
    </div>
  );
}




// ─── Payout structure panel ──────────────────────────────────────────────────

const DEFAULT_ENTRIES = [
  { label: "1st Place", amount: 0 },
  { label: "2nd Place", amount: 0 },
  { label: "3rd Place", amount: 0 },
];

function PayoutStructurePanel({ huddleId }: { huddleId: string }) {
  const { data: saved } = usePayouts(huddleId);
  const setPayouts = useSetPayouts();

  const [entries, setEntries] = useState<Array<{ label: string; amount: number }>>(
    () => DEFAULT_ENTRIES,
  );
  const [initialized, setInitialized] = useState(false);

  useMemo(() => {
    if (saved !== undefined && !initialized) {
      setEntries(
        saved.length > 0
          ? saved.map((e) => ({ label: e.label, amount: e.amount }))
          : DEFAULT_ENTRIES,
      );
      setInitialized(true);
    }
  }, [saved, initialized]);

  const totalCents = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const updateEntry = (i: number, field: "label" | "amount", val: string) => {
    setEntries((prev) =>
      prev.map((e, idx) =>
        idx === i
          ? { ...e, [field]: field === "amount" ? Math.round(parseFloat(val || "0") * 100) : val }
          : e,
      ),
    );
  };

  const addEntry = () => setEntries((prev) => [...prev, { label: "", amount: 0 }]);
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));
  const handleSave = () => setPayouts.mutate({ huddleId, entries });

  return (
    <Panel>
      <PanelHeader
        title="Payout Structure"
        description="Define how the prize pool is distributed. Amounts are for reference — Huddle doesn't process payments."
      />
      <div className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={e.label}
              onChange={(ev) => updateEntry(i, "label", ev.target.value)}
              placeholder="Label (e.g. 1st Place)"
              maxLength={120}
              className="flex-1 text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
            />
            <div className="relative shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted font-sans">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={e.amount / 100 || ""}
                onChange={(ev) => updateEntry(i, "amount", ev.target.value)}
                placeholder="0.00"
                className="w-24 text-[13px] font-sans border border-line rounded-md pl-6 pr-2 py-1.5 bg-paper text-ink"
              />
            </div>
            <button
              onClick={() => removeEntry(i)}
              className="text-muted hover:text-red-600 transition-colors p-1"
              aria-label="Remove entry"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <Btn onClick={addEntry}>
          <Plus size={13} className="mr-1" /> Add entry
        </Btn>
        <span className="text-[12px] font-mono text-muted">
          Total pool: <span className="text-ink font-semibold">{fmt(totalCents)}</span>
        </span>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
        {setPayouts.isError && (
          <p className="text-[11.5px] text-red-600 font-sans flex-1">
            {(setPayouts.error as Error).message}
          </p>
        )}
        {setPayouts.isSuccess && (
          <p className="text-[11.5px] text-accent font-sans">Saved!</p>
        )}
        <BtnPrimary onClick={handleSave} disabled={setPayouts.isPending}>
          {setPayouts.isPending ? "Saving…" : "Save payouts"}
        </BtnPrimary>
      </div>
    </Panel>
  );
}

// ─── Trophy Room panel ───────────────────────────────────────────────────────

const BUILT_IN_TROPHIES: Array<{
  type: string;
  label: string;
  sub: string;
  kind: string;
}> = [
  { type: "champion",       label: "Champion",       sub: "League champion",         kind: "cup"    },
  { type: "runner_up",      label: "Runner-Up",      sub: "Championship finalist",   kind: "medal"  },
  { type: "third",          label: "3rd Place",      sub: "Consolation winner",      kind: "medal"  },
  { type: "high_score",     label: "High Score",     sub: "Top single-week score",   kind: "star"   },
  { type: "missed_playoffs",label: "Missed Playoffs",sub: "Patience builds character",kind: "ribbon" },
];

function TrophyRoomPanel({
  huddleId,
  rosters,
  leagueUsers,
}: {
  huddleId: string;
  rosters: Roster[];
  leagueUsers: TeamUser[];
}) {
  const { data: active } = useActiveTrophies(huddleId);
  const toggle = useSetTrophyEnabled();
  const { data: icons = [] } = useAwardIcons();
  // Map icon id → svg content for quick lookup
  const iconMap = useMemo(
    () => new Map(icons.map((ic) => [ic.id, ic.svg])),
    [icons],
  );

  // ── Custom awards state (merged from CustomAwardsPanel) ──────────────────
  const awardsQuery = useAwards(huddleId);
  const createAward = useCreateAward();
  const updateAward = useUpdateAward();
  const deleteAward = useDeleteAward();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [glyph, setGlyph] = useState("cup");
  const [color, setColor] = useState(AWARD_COLORS[4]!.hex);
  const [awardTitle, setAwardTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rosterId, setRosterId] = useState<number | "">("");
  const [season, setSeason] = useState("");

  function startEdit(a: HuddleAward) {
    setEditingId(a.id);
    setGlyph(a.glyph);
    setColor(a.color);
    setAwardTitle(a.title);
    setDescription(a.description ?? "");
    setRosterId(a.rosterId);
    setSeason(a.season ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setGlyph("cup");
    setColor(AWARD_COLORS[4]!.hex);
    setAwardTitle("");
    setDescription("");
    setRosterId("");
    setSeason("");
  }

  function handleAwardSubmit() {
    if (!rosterId || !awardTitle.trim()) return;
    const payload = {
      huddleId,
      rosterId: rosterId as number,
      glyph,
      color,
      title: awardTitle.trim(),
      description: description.trim() || undefined,
      season: season.trim() || undefined,
    };
    if (editingId) {
      updateAward.mutate({ ...payload, awardId: editingId }, { onSuccess: cancelEdit });
    } else {
      createAward.mutate(payload, { onSuccess: cancelEdit });
    }
  }

  const sortedRosters = useMemo(
    () => [...rosters].sort((a, b) => a.rosterId - b.rosterId),
    [rosters],
  );

  function rosterLabel(r: Roster): string {
    return rosterTeamName(r, leagueUsers);
  }

  function teamNameForRosterId(id: number): string {
    const r = rosters.find((x) => x.rosterId === id);
    return r ? rosterLabel(r) : `Team ${id}`;
  }

  const awards = awardsQuery.data ?? [];

  return (
    <Panel>
      <PanelHeader
        title="Trophy Room"
        description="Control which automatic trophies are active and grant custom awards to teams."
      />

      {/* ── Built-in trophy toggles ─────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-2">
          Built-in trophies
        </p>
        <div className="flex flex-col divide-y divide-line">
          {BUILT_IN_TROPHIES.map((t) => {
            const enabled = active ? (active[t.type] !== false) : true;
            return (
              <div key={t.type} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-md shrink-0 transition-opacity ${
                      enabled ? "opacity-100" : "opacity-30"
                    }`}
                    style={{ color: enabled ? "#6b7280" : undefined }}
                  >
                    <GlyphSvg kind={t.kind} size={20} />
                  </span>
                  <div className={`min-w-0 transition-opacity ${enabled ? "opacity-100" : "opacity-40"}`}>
                    <p className="text-[13px] font-semibold text-ink font-sans leading-tight">
                      {t.label}
                    </p>
                    <p className="text-[11px] text-muted font-sans">{t.sub}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    toggle.mutate({ huddleId, trophyType: t.type, enabled: !enabled })
                  }
                  disabled={toggle.isPending}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                    enabled ? "bg-ink" : "bg-line"
                  }`}
                  role="switch"
                  aria-checked={enabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Custom awards ───────────────────────────────────────────── */}
      <div className="border-t border-line pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-3">
          {editingId ? "Edit custom award" : "Grant a custom award"}
        </p>
        <div className="flex flex-col gap-3">
          {/* Glyph picker + colour */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">Glyph</p>
              {/* Built-in glyphs */}
              <div className="grid grid-cols-6 gap-1.5 mb-1.5">
                {AWARD_GLYPHS.map((g) => (
                  <button
                    key={g.kind}
                    title={g.label}
                    onClick={() => setGlyph(g.kind)}
                    className={`flex items-center justify-center w-10 h-10 rounded-md border transition-colors ${
                      glyph === g.kind ? "border-ink bg-highlight" : "border-line hover:bg-highlight"
                    }`}
                    style={{ color }}
                  >
                    <GlyphSvg kind={g.kind} size={22} />
                  </button>
                ))}
              </div>
              {/* Custom icon files */}
              {icons.length > 0 && (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted font-sans mb-1">
                    Custom icons
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {icons.map((ic: AwardIcon) => {
                      const kind = `icon:${ic.id}`;
                      return (
                        <button
                          key={ic.id}
                          title={ic.name}
                          onClick={() => setGlyph(kind)}
                          className={`flex items-center justify-center w-10 h-10 rounded-md border transition-colors ${
                            glyph === kind ? "border-ink bg-highlight" : "border-line hover:bg-highlight"
                          }`}
                          style={{ color }}
                        >
                          <GlyphSvg kind={kind} size={22} iconSvg={ic.svg} />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 mt-5"
              style={{ backgroundColor: color + "33", color }}
            >
              <GlyphSvg kind={glyph} size={32} iconSvg={iconMap.get(glyph.replace("icon:", ""))} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">Colour</p>
              <div className="flex flex-wrap gap-1.5">
                {AWARD_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c.hex ? "border-ink scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <p className="text-[10px] font-mono text-muted mt-1">{color}</p>
            </div>
          </div>

          {/* Title + season */}
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">Title</p>
              <input
                value={awardTitle}
                onChange={(e) => setAwardTitle(e.target.value.slice(0, 80))}
                maxLength={80}
                className="w-full text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink"
                placeholder="e.g. Sacko, Most Improved…"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">Season</p>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value.slice(0, 10))}
                maxLength={10}
                className="w-20 text-[13px] font-sans border border-line rounded-md px-2 py-1.5 bg-paper text-ink"
                placeholder={String(new Date().getFullYear())}
              />
            </div>
          </div>

          {/* Team selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">Recipient Team</p>
            <select
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : "")}
              className="w-full text-[13px] font-sans border border-line rounded-md px-2 py-1.5 bg-paper text-ink"
            >
              <option value="">Select a team…</option>
              {sortedRosters.map((r) => (
                <option key={r.rosterId} value={r.rosterId}>{rosterLabel(r)}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">
              Description <span className="normal-case">(optional)</span>
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              maxLength={300}
              rows={2}
              className="w-full text-[13px] font-sans border border-line rounded-md px-3 py-1.5 bg-paper text-ink resize-none"
              placeholder="Brief note about why this award was given…"
            />
          </div>

          {/* Full-width live preview — exact replica of a trophy room card */}
          {awardTitle.trim() && (
            <div className="rounded-md border border-line bg-highlight/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-2">
                Trophy room preview
              </p>
              <div
                className="relative flex flex-col p-3.5 border w-36"
                style={{ borderColor: color + "66", backgroundColor: color + "11" }}
              >
                {season && (
                  <div
                    className="absolute top-0 right-0 px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wider text-white"
                    style={{ backgroundColor: color }}
                  >
                    {season}
                  </div>
                )}
                <div className="mb-2" style={{ color }}>
                  <GlyphSvg kind={glyph} size={32} iconSvg={iconMap.get(glyph.replace("icon:", ""))} />
                </div>
                <div className="font-serif italic font-bold text-[14px] text-ink leading-tight tracking-tight">
                  {awardTitle}
                </div>
                {description && (
                  <div className="font-serif text-xs text-body mt-1 leading-snug line-clamp-2">
                    {description}
                  </div>
                )}
                <div className="flex-1" />
                <div
                  className="mt-2 pt-1.5 border-t border-dotted border-line text-[9.5px] uppercase tracking-wider font-sans font-semibold"
                  style={{ color }}
                >
                  Commissioner
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {(createAward.isError || updateAward.isError) && (
              <p className="text-[11.5px] text-red-600 font-sans flex-1">
                {((createAward.error ?? updateAward.error) as Error).message}
              </p>
            )}
            {editingId && <Btn onClick={cancelEdit}>Cancel</Btn>}
            <BtnPrimary
              onClick={handleAwardSubmit}
              disabled={!awardTitle.trim() || !rosterId || createAward.isPending || updateAward.isPending}
            >
              {createAward.isPending || updateAward.isPending
                ? editingId ? "Saving…" : "Granting…"
                : editingId ? "Save changes" : "Grant award"}
            </BtnPrimary>
          </div>
        </div>

        {/* Existing custom awards list */}
        {awards.length > 0 && (
          <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-line">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans">
              Granted awards ({awards.length})
            </p>
            {awards.map((a) => (
              <AwardBadge
                key={a.id}
                award={a}
                teamName={teamNameForRosterId(a.rosterId)}
                onEdit={() => startEdit(a)}
                onDelete={() => deleteAward.mutate({ huddleId, awardId: a.id })}
                deleting={deleteAward.isPending}
                iconSvg={a.glyph.startsWith("icon:") ? iconMap.get(a.glyph.replace("icon:", "")) : undefined}
              />
            ))}
            {deleteAward.isError && (
              <p className="text-[11.5px] text-red-600 font-sans">
                {(deleteAward.error as Error).message}
              </p>
            )}
          </div>
        )}
      </div>
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
          {huddle ? (
            <DuesTrackerPanel
              huddleId={huddle.id}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
            />
          ) : (
            <StubSection
              icon={DollarSign}
              title="Dues Tracker"
              description="Set the buy-in amount and mark who has paid. Members can see their own status; only you see the full picture."
              tag="Finance"
            />
          )}
          {huddle ? (
            <PayoutStructurePanel huddleId={huddle.id} />
          ) : (
            <StubSection
              icon={Trophy}
              title="Payout Structure"
              description="Define how the prize pool is distributed — 1st, 2nd, 3rd place, most points, best regular-season record, or any split you like."
              tag="Finance"
            />
          )}
          {huddle ? (
            <TrophyRoomPanel
              huddleId={huddle.id}
              rosters={rosters ?? []}
              leagueUsers={leagueUsers ?? []}
            />
          ) : (
            <StubSection
              icon={Award}
              title="Trophy Room"
              description="Enable or disable automatic trophies and grant custom awards to teams."
              tag="Awards"
            />
          )}

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
