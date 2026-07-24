/**
 * ForumPage — league message board, topic list.
 *
 * Route: /league/forum
 *
 * Anyone with an approved claim in the huddle can start a topic or reply.
 * Topics are sorted by most recent activity (own reply bumps a topic back
 * to the top). See `ForumTopicPage.tsx` for the thread view.
 */
import { useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Navigate, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, X } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import { useForumTopics, useCreateTopic } from "../hooks/useForum";
import { PollComposer, EMPTY_POLL_INPUT } from "../components/PollComposer";
import type { NewPollInput } from "../types/huddle";

// ── Shared primitives ─────────────────────────────────────────────────────────

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-line rounded-lg p-5 flex flex-col gap-4 bg-paper">
      {children}
    </div>
  );
}

export function PanelHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-line pb-3">
      <h2 className="font-serif font-semibold text-[15px] text-ink leading-tight">{title}</h2>
      {description && (
        <p className="mt-1 text-[12.5px] text-muted font-sans leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  danger,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  variant?: "default" | "primary";
}) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium font-sans transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : "border-line text-ink hover:bg-highlight"
        }`}
    >
      {children}
    </button>
  );
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── New Topic Form ────────────────────────────────────────────────────────────

function NewTopicForm({
  huddleId,
  onClose,
  onCreated,
}: {
  huddleId: string;
  onClose: () => void;
  onCreated: (topicId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [addPoll, setAddPoll] = useState(false);
  const [poll, setPoll] = useState<NewPollInput>(EMPTY_POLL_INPUT);
  const [error, setError] = useState<string | null>(null);
  const createTopic = useCreateTopic();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const topic = await createTopic.mutateAsync({
        huddleId,
        title: title.trim(),
        body: body.trim(),
        poll: addPoll ? poll : undefined,
      });
      onCreated(topic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post topic.");
    }
  }

  return (
    <Panel>
      <PanelHeader title="New Topic" description="Start a discussion for the league." />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-sans text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Trade deadline thoughts"
            maxLength={120}
            required
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            maxLength={4000}
            required
            className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 resize-none"
          />
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-ink">
          <input
            type="checkbox"
            checked={addPoll}
            onChange={(e) => setAddPoll(e.target.checked)}
            className="accent-ink"
          />
          Add a poll
        </label>

        {addPoll && <PollComposer value={poll} onChange={setPoll} />}

        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Btn variant="primary" disabled={createTopic.isPending}>
            {createTopic.isPending ? "Posting…" : "Post topic"}
          </Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Panel>
  );
}

// ── Topic Row ─────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  authorName,
  onClick,
}: {
  topic: { id: string; title: string; body: string; replyCount: number; updatedAt: string };
  authorName: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-line rounded-lg p-4 bg-paper hover:bg-highlight transition-colors flex items-start justify-between gap-3"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-snug truncate">{topic.title}</p>
        <p className="text-[11px] text-muted font-sans">
          {authorName} · {formatDateTime(topic.updatedAt)}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-muted font-sans font-medium">
        {topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"}
      </span>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ForumPage() {
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { user } = useUser();
  const myClerkId = user?.id ?? "";
  const navigate = useNavigate();

  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;

  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { data: topics = [], isLoading } = useForumTopics(huddleId);

  const [showNewForm, setShowNewForm] = useState(false);

  const canPost = huddleDetail?.myClaim?.status === "approved";

  // Build clerkUserId → display name map from approved claims + Sleeper data
  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!huddleDetail?.claims || !rosters || !leagueUsers) return map;

    for (const claim of huddleDetail.claims) {
      if (claim.status !== "approved" || !claim.user) continue;
      const roster = rosters.find((r) => r.rosterId === claim.rosterId);
      const sleepUser = roster?.ownerId
        ? leagueUsers.find((u) => u.userId === roster.ownerId)
        : null;
      const displayName =
        sleepUser?.teamName ?? sleepUser?.displayName ?? claim.user.username ?? `Team ${claim.rosterId}`;
      map.set(claim.user.id, displayName);
    }
    return map;
  }, [huddleDetail, rosters, leagueUsers]);

  const resolveName = (clerkId: string) => nameMap.get(clerkId) ?? (clerkId === myClerkId ? "You" : "Unknown");

  if (!selectedLeagueId) return <Navigate to="/" replace />;
  if (!huddleId) {
    return (
      <div className="p-8 max-w-xl">
        <p className="text-sm text-muted font-sans">
          No huddle is linked to this league yet. Ask your commissioner to set one up.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-muted shrink-0" />
            <h1 className="font-serif font-semibold text-xl text-ink">Forum</h1>
          </div>
          <p className="mt-1 text-[12.5px] text-muted font-sans">
            League discussion — start a topic and see what everyone thinks.
          </p>
        </div>
        {canPost && (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium font-sans hover:opacity-90 transition-colors shrink-0"
          >
            {showNewForm ? <X size={13} /> : <Plus size={13} />}
            {showNewForm ? "Close" : "New Topic"}
          </button>
        )}
      </div>

      {!canPost && (
        <p className="text-[12px] text-muted font-sans -mt-2">
          Only approved league members can post. Claim your team to join the discussion.
        </p>
      )}

      {/* New topic form */}
      {showNewForm && (
        <NewTopicForm
          huddleId={huddleId}
          onClose={() => setShowNewForm(false)}
          onCreated={(topicId) => navigate(`/league/forum/${topicId}`)}
        />
      )}

      {/* Topic list */}
      {isLoading ? (
        <p className="text-sm text-muted font-sans">Loading topics…</p>
      ) : topics.length === 0 ? (
        <div className="py-10 text-center">
          <MessageSquare size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted font-sans">No topics yet.</p>
          {canPost && (
            <p className="text-xs text-muted font-sans mt-1">Hit "New Topic" to start the discussion.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              authorName={resolveName(topic.authorId)}
              onClick={() => navigate(`/league/forum/${topic.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
