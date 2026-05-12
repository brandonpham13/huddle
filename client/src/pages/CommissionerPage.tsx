/**
 * CommissionerPage — admin control panel for league commissioners.
 *
 * Access: only rendered when the current user is the Sleeper commissioner
 * (isOwner = true) for the selected league. The sidebar entry is also
 * conditionally hidden for non-commissioners, so this page is doubly-gated.
 *
 * Feature sections (stubs — to be wired in future PRs):
 *   - Announcements   post league-wide messages pinned to the dashboard
 *   - Dues Tracker    mark who has/hasn't paid, set amounts
 *   - Payout Builder  define payout structure (1st, 2nd, 3rd, etc.)
 *   - Custom Awards   grant trophy-style awards to any team
 */
import { Navigate } from "react-router-dom";
import { Megaphone, DollarSign, Trophy, Award } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueUsers } from "../hooks/useSleeper";

// ─── Access guard ─────────────────────────────────────────────────────────────

/**
 * Hook: returns true if the currently-signed-in Sleeper user is the
 * commissioner (isOwner) of the currently-selected league.
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

// ─── Stub section card ────────────────────────────────────────────────────────

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
      <div className="h-16 rounded-md bg-highlight/50 border border-dashed border-line flex items-center justify-center">
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

  // Hard redirect if somehow a non-commissioner navigates here directly.
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

        {/* Feature sections */}
        <div className="flex flex-col gap-5">
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
