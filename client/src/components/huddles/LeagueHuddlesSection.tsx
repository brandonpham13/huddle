import { useState } from "react";
import { Button } from "../ui/button";
import { CreateHuddleModal } from "./CreateHuddleModal";
import { JoinHuddleModal } from "./JoinHuddleModal";

export function LeagueHuddlesSection({ leagueId }: { leagueId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between">
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

      {createOpen && (
        <CreateHuddleModal
          leagueId={leagueId}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {joinOpen && <JoinHuddleModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
