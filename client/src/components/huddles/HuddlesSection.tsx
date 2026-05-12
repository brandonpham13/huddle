/**
 * Standalone "My Huddles" section for the Leagues page.
 *
 * Huddles are now independent of leagues — a commissioner links a Sleeper
 * league from inside the huddle settings page. This component just lists all
 * huddles the current user belongs to (as commissioner or via an approved
 * claim) and surfaces Create / Join entry points.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useMyHuddles } from "../../hooks/useHuddles";
import { CreateHuddleModal } from "./CreateHuddleModal";
import { JoinHuddleModal } from "./JoinHuddleModal";

export function HuddlesSection() {
  const { data: huddles, isLoading } = useMyHuddles();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">
          My Huddles
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
            Join
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            Create
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {!isLoading && (huddles?.length ?? 0) === 0 && (
        <p className="text-xs text-gray-400 italic">
          No huddles yet — create one or ask your commissioner for an invite code.
        </p>
      )}

      {!isLoading && (huddles?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {huddles!.map((h) => (
            <div key={h.id} className="flex items-center justify-between text-sm">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="truncate font-medium">{h.name}</span>
                {h.myStatus === "pending" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                    Pending
                  </span>
                )}
                {h.myStatus !== "pending" && !h.leagueId && (
                  <span className="text-xs text-amber-500 shrink-0">
                    no league linked
                  </span>
                )}
              </div>
              <Link
                to={`/huddles/${h.id}`}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:underline shrink-0 ml-2"
              >
                {h.myStatus === "pending" ? "View" : "Open"}
                <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateHuddleModal onClose={() => setCreateOpen(false)} />}
      {joinOpen && <JoinHuddleModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
