import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { useCreateHuddle } from "../../hooks/useHuddles";
import {
  useLeague,
  useLeagueRosters,
  useLeagueUsers,
} from "../../hooks/useSleeper";
import type { Huddle } from "../../types/huddle";

export function CreateHuddleModal({
  leagueId,
  onClose,
}: {
  leagueId: string;
  onClose: () => void;
}) {
  const { data: league } = useLeague(leagueId);
  const { data: rosters } = useLeagueRosters(leagueId);
  const { data: leagueUsers } = useLeagueUsers(leagueId);
  const create = useCreateHuddle();
  const navigate = useNavigate();

  const [name, setName] = useState(league?.name ?? "");
  const [rosterId, setRosterId] = useState<number | null>(null);
  const [created, setCreated] = useState<Huddle | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = name.trim().length > 0 && !create.isPending;

  const handleSubmit = () => {
    create.mutate(
      {
        leagueProvider: "sleeper",
        leagueId,
        name: name.trim(),
        rosterId: rosterId ?? undefined,
      },
      { onSuccess: (huddle) => setCreated(huddle) },
    );
  };

  const handleCopy = () => {
    if (created?.inviteCode) {
      navigator.clipboard.writeText(created.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // After creation: show invite code
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
            <h2 className="text-lg font-bold">Huddle created! 🎉</h2>
            <p className="text-sm text-gray-500 mt-1">
              Share this invite code with your league members so they can join.
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
                navigate(`/huddles/${created.id}`);
              }}
            >
              Go to huddle →
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-lg font-bold">Create huddle</h2>
          <p className="text-sm text-gray-500 mt-1">
            You'll be the commissioner. An invite code is generated
            automatically — share it with your league.
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Huddle name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
            className="w-full text-sm border rounded-md px-2 py-1.5"
            placeholder={league?.name ?? "Huddle name"}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Your team (optional)
          </label>
          <select
            value={rosterId ?? ""}
            onChange={(e) =>
              setRosterId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">— Skip; claim later —</option>
            {(rosters ?? []).map((r) => {
              const owner = r.ownerId
                ? leagueUsers?.find((u) => u.userId === r.ownerId)
                : null;
              const teamName =
                owner?.teamName ?? owner?.displayName ?? `Team ${r.rosterId}`;
              return (
                <option key={r.rosterId} value={r.rosterId}>
                  {teamName}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Selecting a team auto-claims it for you.
          </p>
        </div>

        {create.isError && (
          <p className="text-xs text-red-500">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? "Creating…" : "Create huddle"}
          </Button>
        </div>
      </div>
    </div>
  );
}
