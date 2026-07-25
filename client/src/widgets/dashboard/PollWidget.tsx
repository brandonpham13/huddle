/**
 * PollWidget — commissioner-configured poll shown on the dashboard.
 *
 * Renders null when there's no huddle linked to the selected league, no
 * poll has been set, or the user is viewing a past season (mirrors
 * CountdownWidget's season gating — a poll is a "right now" thing, not
 * something relevant to an archived season).
 *
 * Placement: right column of the dashboard, stacked directly under
 * CountdownWidget (see DashboardPage.tsx).
 */
import { useState } from "react";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../../hooks/useHuddles";
import { useDashboardPoll, useVoteOnDashboardPoll } from "../../hooks/usePolls";
import { PollCard } from "../../components/PollCard";
import { SectionHead } from "./_shared";

export function PollWidget({ isCurrentSeason }: { isCurrentSeason: boolean }) {
  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;
  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: poll } = useDashboardPoll(huddleId);
  const voteOnPoll = useVoteOnDashboardPoll();
  const [voteError, setVoteError] = useState<string | null>(null);

  if (!isCurrentSeason || !huddleId || !poll) return null;

  const canVote = huddleDetail?.myClaim?.status === "approved";

  async function handleVote(optionIds: string[]) {
    setVoteError(null);
    try {
      await voteOnPoll.mutateAsync({ huddleId: huddleId!, pollId: poll!.id, optionIds });
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to vote.");
    }
  }

  return (
    <div className="border border-line rounded-lg p-5 bg-paper flex flex-col gap-1">
      <SectionHead kicker="LEAGUE POLL" title="What do you think?" rule={null} />
      {canVote ? (
        <PollCard poll={poll} onVote={handleVote} voting={voteOnPoll.isPending} error={voteError} />
      ) : (
        <p className="text-[12px] text-muted font-sans">
          Only approved league members can vote. Claim your team to join in.
        </p>
      )}
    </div>
  );
}
