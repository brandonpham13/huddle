/**
 * SideBetsPage — league members propose and track side bets on weekly matchups.
 *
 * Route: /side-bets
 *
 * Anyone with an approved claim in the huddle can:
 *   - Propose a bet against another member for any week
 *   - Accept or reject incoming bets
 *   - Cancel a pending bet they proposed (or cancel an accepted bet)
 *   - Settle an accepted bet by declaring the winner
 *
 * Commissioners can cancel or settle any bet.
 */
import { useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { Handshake, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers, useNFLState } from "../hooks/useSleeper";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import {
  useSideBets,
  useProposeBet,
  useRespondToBet,
  useCancelBet,
  useSettleBet,
} from "../hooks/useSideBets";
import type { SideBet } from "../types/huddle";

// ── Shared primitives ─────────────────────────────────────────────────────────

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-line rounded-lg p-5 flex flex-col gap-4 bg-paper">
      {children}
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-line pb-3">
      <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">{title}</h2>
      {description && (
        <p className="mt-1 text-[12.5px] text-muted font-sans leading-relaxed">{description}</p>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  danger,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  variant?: "default" | "primary";
}) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium font-sans transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : "border-line text-ink hover:bg-highlight"
        }`}
    >
      {children}
    </button>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  settled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-sans uppercase tracking-wide ${STATUS_STYLES[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  if (cents === 0) return "Bragging rights";
  const dollars = cents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

// ── New Bet Form ──────────────────────────────────────────────────────────────

interface OpponentOption {
  clerkUserId: string;
  rosterId: number;
  displayName: string;
}

function NewBetForm({
  huddleId,
  currentWeek,
  season,
  opponents,
  myRosterId,
  onClose,
}: {
  huddleId: string;
  currentWeek: number;
  season: string;
  opponents: OpponentOption[];
  myRosterId: number | null;
  onClose: () => void;
}) {
  const [opponentId, setOpponentId] = useState(opponents[0]?.clerkUserId ?? "");
  const [week, setWeek] = useState(currentWeek);
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  const proposeBet = useProposeBet();

  const selectedOpponent = opponents.find((o) => o.clerkUserId === opponentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = amountDollars === "" ? 0 : Math.round(parseFloat(amountDollars) * 100);
    if (amountDollars !== "" && (isNaN(amount) || amount < 0)) {
      setError("Enter a valid dollar amount (or leave blank for bragging rights).");
      return;
    }

    try {
      await proposeBet.mutateAsync({
        huddleId,
        opponentId,
        proposerRosterId: myRosterId ?? undefined,
        opponentRosterId: selectedOpponent?.rosterId,
        week,
        season,
        description: description.trim(),
        amount,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose bet.");
    }
  }

  return (
    <Panel>
      <PanelHeader title="New Side Bet" description="Challenge a league member to a friendly wager." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-sm">
        {/* Opponent */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Opponent
          </label>
          <select
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            required
          >
            {opponents.map((o) => (
              <option key={o.clerkUserId} value={o.clerkUserId}>
                {o.displayName}
              </option>
            ))}
            {opponents.length === 0 && (
              <option value="" disabled>
                No other league members
              </option>
            )}
          </select>
        </div>

        {/* Week */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Week
          </label>
          <input
            type="number"
            min={1}
            max={18}
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 w-24"
            required
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Amount (leave blank for bragging rights)
          </label>
          <div className="flex items-center gap-1">
            <span className="text-muted text-sm">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 w-32"
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            What's the bet?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. My team beats yours this week"
            rows={2}
            required
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 resize-none"
          />
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Btn variant="primary" disabled={proposeBet.isPending || opponents.length === 0}>
            {proposeBet.isPending ? "Sending…" : "Propose Bet"}
          </Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Panel>
  );
}

// ── Settle Modal ──────────────────────────────────────────────────────────────

function SettleForm({
  bet,
  huddleId,
  proposerName: propName,
  opponentName: oppName,
  onClose,
}: {
  bet: SideBet;
  huddleId: string;
  proposerName: string;
  opponentName: string;
  onClose: () => void;
}) {
  const [winnerId, setWinnerId] = useState(bet.proposerId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const settleBet = useSettleBet();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await settleBet.mutateAsync({ huddleId, betId: bet.id, winnerId, settlementNote: note });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to settle bet.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 border border-line rounded-lg bg-paper font-sans text-sm mt-2">
      <p className="text-[12.5px] font-semibold text-ink">Who won?</p>
      <div className="flex flex-col gap-1.5">
        {[
          { id: bet.proposerId, name: propName },
          { id: bet.opponentId, name: oppName },
        ].map(({ id, name }) => (
          <label key={id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="winner"
              value={id}
              checked={winnerId === id}
              onChange={() => setWinnerId(id)}
              className="accent-ink"
            />
            <span className="text-ink">{name}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Note (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Final score was 142–118"
          className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
        />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Btn variant="primary" disabled={settleBet.isPending}>
          {settleBet.isPending ? "Settling…" : "Settle"}
        </Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </form>
  );
}

// ── Bet Card ──────────────────────────────────────────────────────────────────

function BetCard({
  bet,
  huddleId,
  myClerkId,
  proposerName,
  opponentName,
  isCommissioner,
}: {
  bet: SideBet;
  huddleId: string;
  myClerkId: string;
  proposerName: string;
  opponentName: string;
  isCommissioner: boolean;
}) {
  const [showSettle, setShowSettle] = useState(false);
  const respondToBet = useRespondToBet();
  const cancelBet = useCancelBet();

  const isProposer = bet.proposerId === myClerkId;
  const isOpponent = bet.opponentId === myClerkId;
  const isParty = isProposer || isOpponent;

  const winnerName =
    bet.winnerId === bet.proposerId
      ? proposerName
      : bet.winnerId === bet.opponentId
        ? opponentName
        : null;

  return (
    <div className="border border-line rounded-lg p-4 bg-paper flex flex-col gap-2.5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] font-semibold text-ink leading-snug">{bet.description}</p>
          <p className="text-[11px] text-muted font-sans">
            Week {bet.week} · {formatAmount(bet.amount)}
          </p>
        </div>
        <StatusBadge status={bet.status} />
      </div>

      {/* Parties */}
      <div className="flex items-center gap-2 text-[12px] font-sans text-muted">
        <span className="text-ink font-medium">{proposerName}</span>
        <span>challenged</span>
        <span className="text-ink font-medium">{opponentName}</span>
      </div>

      {/* Settlement note or winner */}
      {bet.status === "settled" && (
        <div className="text-[12px] font-sans">
          <span className="text-green-700 dark:text-green-400 font-semibold">{winnerName} won</span>
          {bet.settlementNote && (
            <span className="text-muted ml-1">— {bet.settlementNote}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {/* Opponent responds to pending bet */}
        {bet.status === "pending" && isOpponent && (
          <>
            <Btn
              variant="primary"
              disabled={respondToBet.isPending}
              onClick={() =>
                respondToBet.mutate({ huddleId, betId: bet.id, response: "accepted" })
              }
            >
              Accept
            </Btn>
            <Btn
              danger
              disabled={respondToBet.isPending}
              onClick={() =>
                respondToBet.mutate({ huddleId, betId: bet.id, response: "rejected" })
              }
            >
              Reject
            </Btn>
          </>
        )}

        {/* Proposer waits on pending, can cancel */}
        {bet.status === "pending" && isProposer && (
          <span className="text-[11px] text-muted font-sans self-center">
            Waiting for {opponentName}…
          </span>
        )}

        {/* Either party or commissioner can cancel pending/accepted */}
        {(bet.status === "pending" || bet.status === "accepted") &&
          (isParty || isCommissioner) && (
            <Btn
              danger
              disabled={cancelBet.isPending}
              onClick={() => cancelBet.mutate({ huddleId, betId: bet.id })}
            >
              Cancel bet
            </Btn>
          )}

        {/* Either party or commissioner can settle an accepted bet */}
        {bet.status === "accepted" && (isParty || isCommissioner) && !showSettle && (
          <Btn onClick={() => setShowSettle(true)}>Settle</Btn>
        )}
      </div>

      {showSettle && (
        <SettleForm
          bet={bet}
          huddleId={huddleId}
          proposerName={proposerName}
          opponentName={opponentName}
          onClose={() => setShowSettle(false)}
        />
      )}
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

type Filter = "all" | "mine" | "pending" | "active" | "history";

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "history", label: "History" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SideBetsPage() {
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { user } = useUser();
  const myClerkId = user?.id ?? "";

  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;

  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: nflState } = useNFLState();
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { data: bets = [], isLoading } = useSideBets(huddleId);

  const [filter, setFilter] = useState<Filter>("all");
  const [showNewForm, setShowNewForm] = useState(false);

  const isCommissioner = huddleDetail?.huddle?.isCommissioner ?? false;
  const currentWeek = nflState?.week ?? 1;
  const season = nflState?.season ?? new Date().getFullYear().toString();

  // Build clerkUserId → display name map from approved claims + Sleeper data
  const nameMap = useMemo(() => {
    const map = new Map<string, { displayName: string; rosterId: number }>();
    if (!huddleDetail?.claims || !rosters || !leagueUsers) return map;

    for (const claim of huddleDetail.claims) {
      if (claim.status !== "approved" || !claim.user) continue;
      const clerkId = claim.user.id;
      const roster = rosters.find((r) => r.rosterId === claim.rosterId);
      const sleepUser = roster?.ownerId
        ? leagueUsers.find((u) => u.userId === roster.ownerId)
        : null;
      const displayName =
        sleepUser?.teamName ?? sleepUser?.displayName ?? claim.user.username ?? `Team ${claim.rosterId}`;
      map.set(clerkId, { displayName, rosterId: claim.rosterId });
    }
    return map;
  }, [huddleDetail, rosters, leagueUsers]);

  const resolveName = (clerkId: string) =>
    nameMap.get(clerkId)?.displayName ?? "Unknown";

  // Opponents list (everyone in the huddle except me)
  const opponents = useMemo<OpponentOption[]>(() => {
    return [...nameMap.entries()]
      .filter(([id]) => id !== myClerkId)
      .map(([id, { displayName, rosterId }]) => ({
        clerkUserId: id,
        rosterId,
        displayName,
      }));
  }, [nameMap, myClerkId]);

  // My rosterId from claims
  const myRosterId =
    huddleDetail?.claims.find(
      (c) => c.status === "approved" && c.user?.id === myClerkId,
    )?.rosterId ?? null;

  // Filter bets
  const filteredBets = useMemo(() => {
    switch (filter) {
      case "mine":
        return bets.filter(
          (b) => b.proposerId === myClerkId || b.opponentId === myClerkId,
        );
      case "pending":
        return bets.filter((b) => b.status === "pending");
      case "active":
        return bets.filter((b) => b.status === "accepted");
      case "history":
        return bets.filter((b) =>
          ["settled", "rejected", "cancelled"].includes(b.status),
        );
      default:
        return bets;
    }
  }, [bets, filter, myClerkId]);

  // Stats
  const activeBets = bets.filter((b) => b.status === "accepted");
  const pendingBets = bets.filter((b) => b.status === "pending");
  const totalAtStake = activeBets.reduce((sum, b) => sum + b.amount, 0);

  if (!selectedLeagueId) return <Navigate to="/" replace />;
  if (!huddleId) {
    return (
      <div className="p-8 max-w-xl">
        <p className="text-sm text-muted font-sans">
          No huddle is linked to this league yet. Ask your commissioner to set one up.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-muted shrink-0" />
            <h1 className="font-serif font-semibold text-xl text-ink">Side Bets</h1>
          </div>
          <p className="mt-1 text-[12.5px] text-muted font-sans">
            Challenge your league mates to friendly wagers on weekly matchups.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans hover:opacity-90 transition-colors shrink-0"
        >
          {showNewForm ? <X size={13} /> : <Plus size={13} />}
          {showNewForm ? "Close" : "New Bet"}
        </button>
      </div>

      {/* Stats row */}
      {(activeBets.length > 0 || pendingBets.length > 0) && (
        <div className="flex gap-6 text-sm font-sans">
          {pendingBets.length > 0 && (
            <div>
              <span className="text-2xl font-serif font-bold text-ink">{pendingBets.length}</span>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
                Awaiting response
              </p>
            </div>
          )}
          {activeBets.length > 0 && (
            <div>
              <span className="text-2xl font-serif font-bold text-ink">{activeBets.length}</span>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">Active</p>
            </div>
          )}
          {totalAtStake > 0 && (
            <div>
              <span className="text-2xl font-serif font-bold text-ink">
                {formatAmount(totalAtStake)}
              </span>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
                At stake
              </p>
            </div>
          )}
        </div>
      )}

      {/* New bet form */}
      {showNewForm && (
        <NewBetForm
          huddleId={huddleId}
          currentWeek={currentWeek}
          season={season}
          opponents={opponents}
          myRosterId={myRosterId}
          onClose={() => setShowNewForm(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-line pb-px">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium font-sans rounded-t-md transition-colors
              ${filter === key ? "text-ink border-b-2 border-ink -mb-px" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bet list */}
      {isLoading ? (
        <p className="text-sm text-muted font-sans">Loading bets…</p>
      ) : filteredBets.length === 0 ? (
        <div className="py-10 text-center">
          <Handshake size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted font-sans">No bets here yet.</p>
          {filter === "all" && (
            <p className="text-xs text-muted font-sans mt-1">
              Hit "New Bet" to challenge a league mate.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredBets.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              huddleId={huddleId}
              myClerkId={myClerkId}
              proposerName={resolveName(bet.proposerId)}
              opponentName={resolveName(bet.opponentId)}
              isCommissioner={isCommissioner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
