import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useCreateHuddle } from "../../hooks/useHuddles";
import { useState } from "react";
import type { Huddle } from "../../types/huddle";

export function CreateHuddleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateHuddle();
  const navigate = useNavigate();
  const [created, setCreated] = useState<Huddle | null>(null);
  const [copied, setCopied] = useState(false);

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
            <h2 className="text-lg font-bold">Huddle created!</h2>
            <p className="text-sm text-gray-500 mt-1">
              Share this invite code with your league members. You'll name it
              properly once you link a Sleeper league from inside the huddle.
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
              className="inline-flex items-center gap-1"
            >
              Go to huddle
              <ChevronRight size={14} />
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
            automatically. Link a Sleeper league from inside the huddle to
            set its name and roster list.
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
          <Button
            onClick={() => create.mutate(undefined, { onSuccess: (h) => setCreated(h) })}
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create huddle"}
          </Button>
        </div>
      </div>
    </div>
  );
}
