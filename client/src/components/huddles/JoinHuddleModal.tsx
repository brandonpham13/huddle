import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { useLookupHuddleByCode } from "../../hooks/useHuddles";

export function JoinHuddleModal({ onClose }: { onClose: () => void }) {
  const lookup = useLookupHuddleByCode();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const canSubmit = code.trim().length === 6 && !lookup.isPending;

  const handleSubmit = () => {
    lookup.mutate(
      { code: code.trim().toUpperCase() },
      {
        onSuccess: (huddle) => {
          onClose();
          navigate(`/huddles/${huddle.id}`);
        },
      },
    );
  };

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
          <h2 className="text-lg font-bold">Join a huddle</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter the 6-character invite code your commissioner shared with you.
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Invite code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
            className="w-full text-2xl font-mono tracking-widest text-center border rounded-md px-2 py-2 uppercase"
            placeholder="ABC123"
          />
        </div>

        {lookup.isError && (
          <p className="text-xs text-red-500">
            {(lookup.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={lookup.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {lookup.isPending ? "Looking up…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
