import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { useHuddlesForLeague } from "../../hooks/useHuddles";
import { CreateHuddleModal } from "./CreateHuddleModal";

export function LeagueHuddlesSection({ leagueId }: { leagueId: string }) {
  const { data: huddles, isLoading } = useHuddlesForLeague("sleeper", leagueId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">
          Huddles{huddles && huddles.length > 0 ? ` (${huddles.length})` : ""}
        </span>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          Create huddle
        </Button>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {!isLoading && (huddles?.length ?? 0) === 0 && (
        <p className="text-xs text-gray-400">No huddles yet for this league.</p>
      )}

      {(huddles?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {huddles!.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate">{g.name}</span>
              <Link
                to={`/huddles/${g.id}`}
                className="text-xs font-medium text-blue-600 hover:underline shrink-0"
              >
                Open →
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
    </div>
  );
}
