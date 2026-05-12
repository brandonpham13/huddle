/**
 * LeaguesPage — huddle list + entry points to create or join a huddle.
 *
 * Commissioner controls have moved to CommissionerPage (/commissioner).
 * Team claims and settings have moved to LeagueSettingsPage (/league-settings).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Hash, ChevronRight } from "lucide-react";
import { useMyHuddles } from "../hooks/useHuddles";
import { useAllSleeperLeagues } from "../hooks/useSleeper";
import { useAppDispatch } from "../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../store/slices/authSlice";
import { CreateHuddleModal } from "../components/huddles/CreateHuddleModal";
import { JoinHuddleModal } from "../components/huddles/JoinHuddleModal";

export function LeaguesPage() {
  const { data: huddles, isLoading } = useMyHuddles();
  const { data: allLeagues } = useAllSleeperLeagues();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  /** Select a league and go to the dashboard. */
  const handleSelectHuddle = (leagueId: string | null) => {
    if (!leagueId || !allLeagues) return;
    const league = allLeagues.find((l) => l.ref.leagueId === leagueId);
    if (!league) return;
    dispatch(setSelectedLeague(league.ref.leagueId));
    dispatch(setSelectedYear(league.season));
    navigate("/");
  };

  return (
    <div className="min-h-full bg-paper text-ink font-sans">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">

        {/* Page header */}
        <div className="mb-8 pb-5 border-b border-line">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted font-sans mb-1">
            My Huddles
          </p>
          <h1 className="font-serif text-3xl font-bold text-ink leading-tight">
            Huddles
          </h1>
          <p className="mt-1.5 text-[13px] text-muted font-sans">
            Create a huddle, invite your league, and link a Sleeper league to
            unlock the full dashboard.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-paper text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Create a Huddle
          </button>
          <button
            onClick={() => setJoinOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-line text-ink text-sm font-medium hover:bg-highlight transition-colors"
          >
            <Hash size={15} />
            Join a Huddle
          </button>
        </div>

        {/* Huddle list */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ink" />
          </div>
        )}

        {!isLoading && (huddles?.length ?? 0) === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-sm">No huddles yet.</p>
            <p className="text-xs mt-1">Create one or ask your commissioner for an invite code.</p>
          </div>
        )}

        {!isLoading && (huddles?.length ?? 0) > 0 && (
          <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden">
            {huddles!.map((h) => (
              <button
                key={h.id}
                onClick={() =>
                  h.leagueId
                    ? handleSelectHuddle(h.leagueId)
                    : navigate(`/huddles/${h.id}`)
                }
                className="flex items-center justify-between px-4 py-3.5 hover:bg-highlight transition-colors text-left w-full"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{h.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {h.myStatus === "pending"
                      ? "Pending approval"
                      : h.leagueId
                        ? "League linked"
                        : "No league linked yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {h.myStatus === "pending" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                      Pending
                    </span>
                  )}
                  {!h.leagueId && h.myStatus !== "pending" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-line text-muted font-semibold">
                      Setup needed
                    </span>
                  )}
                  <ChevronRight size={14} className="text-muted" />
                </div>
              </button>
            ))}
          </div>
        )}

        {createOpen && <CreateHuddleModal onClose={() => setCreateOpen(false)} />}
        {joinOpen && <JoinHuddleModal onClose={() => setJoinOpen(false)} />}
      </div>
    </div>
  );
}
