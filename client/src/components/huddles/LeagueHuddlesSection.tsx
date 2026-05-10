import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useHuddlesForLeague } from "../../hooks/useHuddles";
import { CreateHuddleModal } from "./CreateHuddleModal";
import { JoinHuddleModal } from "./JoinHuddleModal";

export function LeagueHuddlesSection({ leagueId }: { leagueId: string }) {
  const { data: huddles, isLoading } = useHuddlesForLeague("sleeper", leagueId);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">
          Huddles
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
            Join
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
          >
            Create
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {!isLoading && (huddles?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {huddles!.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate">{h.name}</span>
              <Link
                to={`/huddles/${h.id}`}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:underline shrink-0"
              >
                Open
                <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateHuddleModal
          leagueId={leagueId}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {joinOpen && (
        <JoinHuddleModal
          leagueId={leagueId}
          onClose={() => setJoinOpen(false)}
        />
      )}
    </div>
  );
}
