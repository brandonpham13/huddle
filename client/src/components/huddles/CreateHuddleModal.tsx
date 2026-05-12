import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Check } from "lucide-react";
import { Button } from "../ui/button";
import { useCreateHuddle, useLinkLeague } from "../../hooks/useHuddles";
import { useAllSleeperLeagues } from "../../hooks/useSleeper";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setSelectedLeague, setSelectedYear } from "../../store/slices/authSlice";
import { buildFamilyRootMap } from "../../utils/leagueFamily";
import { sleeperAvatarUrl } from "../../utils/sleeperNormalize";
import type { Huddle } from "../../types/huddle";

const STATUS_BADGE: Record<string, string> = {
  in_season: "bg-green-100 text-green-800",
  pre_draft: "bg-yellow-100 text-yellow-800",
  drafting: "bg-blue-100 text-blue-800",
  complete: "bg-gray-100 text-gray-600",
};

export function CreateHuddleModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const create = useCreateHuddle();
  const linkLeague = useLinkLeague();

  const sleeperUsername = useAppSelector((s) => s.auth.user?.sleeperUsername);
  const { data: allLeagues, isLoading: leaguesLoading } = useAllSleeperLeagues();

  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [created, setCreated] = useState<Huddle | null>(null);
  const [copied, setCopied] = useState(false);

  // One entry per league family, newest season wins
  const leagueOptions = useMemo(() => {
    if (!allLeagues) return [];
    const familyRootMap = buildFamilyRootMap(allLeagues);
    const seen = new Set<string>();
    const result: typeof allLeagues = [];
    for (const l of [...allLeagues].sort(
      (a, b) => Number(b.season) - Number(a.season),
    )) {
      const root = familyRootMap.get(l.ref.leagueId) ?? l.ref.leagueId;
      if (seen.has(root)) continue;
      seen.add(root);
      result.push(l);
    }
    return result;
  }, [allLeagues]);

  const selectedLeague = leagueOptions.find(
    (l) => l.ref.leagueId === selectedLeagueId,
  );

  const isPending = create.isPending || linkLeague.isPending;
  const canCreate = !!selectedLeagueId && !isPending;

  const handleCreate = () => {
    create.mutate(undefined, {
      onSuccess: (huddle) => {
        if (selectedLeagueId && selectedLeague) {
          linkLeague.mutate(
            {
              huddleId: huddle.id,
              leagueProvider: "sleeper",
              leagueId: selectedLeagueId,
              leagueName: selectedLeague.name,
            },
            {
              onSuccess: (linked) => {
                // Dispatch the league selection so the dashboard loads it.
                dispatch(setSelectedLeague(selectedLeagueId));
                dispatch(setSelectedYear(selectedLeague.season));
                setCreated(linked);
              },
            },
          );
        } else {
          setCreated(huddle);
        }
      },
    });
  };

  const handleCopy = () => {
    if (created?.inviteCode) {
      navigator.clipboard.writeText(created.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Success screen ----
  if (created) {
    return (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2 className="text-lg font-bold">Huddle created!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Share this invite code with your league members so they can join
              and claim their team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 text-center bg-gray-50 border rounded-md py-3 font-mono text-3xl font-bold tracking-widest text-gray-900">
              {created.inviteCode}
            </div>
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            You can rotate this code any time from the huddle settings.
          </p>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                onClose();
                navigate("/");
              }}
              className="inline-flex items-center gap-1"
            >
              Go to dashboard
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- League picker ----
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold">Create a huddle</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select which Sleeper league this huddle is for. Members will claim
            their roster after joining.
          </p>
        </div>

        {/* No Sleeper account */}
        {!sleeperUsername && (
          <div className="py-6 text-center text-sm text-gray-500 border rounded-md bg-gray-50">
            Connect your Sleeper account in{" "}
            <span className="font-medium">Account → Integrations</span> to
            see your leagues here.
          </div>
        )}

        {/* Loading */}
        {sleeperUsername && leaguesLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        )}

        {/* League list */}
        {sleeperUsername && !leaguesLoading && (
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {leagueOptions.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">
                No leagues found for {sleeperUsername}.
              </p>
            )}
            {leagueOptions.map((league) => {
              const leagueId = league.ref.leagueId;
              const isSelected = selectedLeagueId === leagueId;
              const avatarUrl = sleeperAvatarUrl(league.avatar);

              return (
                <button
                  key={leagueId}
                  onClick={() => setSelectedLeagueId(isSelected ? null : leagueId)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    isSelected
                      ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                      : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={league.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                        {league.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {league.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            STATUS_BADGE[league.status] ?? STATUS_BADGE["complete"]
                          }`}
                        >
                          {league.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-gray-400">
                          {league.totalRosters} teams · {league.season}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={16} className="text-blue-600 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {(create.isError || linkLeague.isError) && (
          <p className="text-xs text-red-500">
            {((create.error ?? linkLeague.error) as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isPending ? "Creating…" : "Create huddle"}
          </Button>
        </div>
      </div>
    </div>
  );
}
