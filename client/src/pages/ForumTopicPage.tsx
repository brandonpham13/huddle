/**
 * ForumTopicPage — a single forum thread (opening post + replies).
 *
 * Route: /league/forum/:topicId
 *
 * Anyone with an approved claim in the huddle can reply. A reply can be
 * removed by its author or a commissioner; the topic itself can only be
 * removed by a commissioner, or by its author before anyone has replied.
 */
import { useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { useLeagueRosters, useLeagueUsers } from "../hooks/useSleeper";
import { useSelectedLeagueHuddle, useHuddleDetail } from "../hooks/useHuddles";
import {
  useForumTopic,
  useForumReplies,
  useCreateReply,
  useDeleteTopic,
  useDeleteReply,
} from "../hooks/useForum";
import { Panel, Btn, formatDateTime } from "./ForumPage";
import type { ForumReply } from "../types/huddle";

// ── Reply composer ────────────────────────────────────────────────────────────

function ReplyComposer({ huddleId, topicId }: { huddleId: string; topicId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createReply = useCreateReply();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createReply.mutateAsync({ huddleId, topicId, body: body.trim() });
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 font-sans text-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={3}
        maxLength={4000}
        required
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink/30 resize-none"
      />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div>
        <Btn variant="primary" disabled={createReply.isPending}>
          {createReply.isPending ? "Posting…" : "Reply"}
        </Btn>
      </div>
    </form>
  );
}

// ── Reply row ─────────────────────────────────────────────────────────────────

function ReplyRow({
  reply,
  authorName,
  canDelete,
  onDelete,
}: {
  reply: ForumReply;
  authorName: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="py-3 border-b border-line last:border-b-0 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-muted font-sans">
          <span className="text-ink font-medium">{authorName}</span> · {formatDateTime(reply.createdAt)}
        </p>
        <p className="mt-1 text-[13px] text-ink font-sans leading-relaxed whitespace-pre-wrap">{reply.body}</p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 text-muted hover:text-red-600 transition-colors"
          aria-label="Delete reply"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ForumTopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const selectedLeagueId = useAppSelector((state) => state.auth.selectedLeagueId);
  const { user } = useUser();
  const myClerkId = user?.id ?? "";
  const navigate = useNavigate();

  const huddle = useSelectedLeagueHuddle();
  const huddleId = huddle?.id ?? null;

  const { data: huddleDetail } = useHuddleDetail(huddleId);
  const { data: rosters } = useLeagueRosters(selectedLeagueId);
  const { data: leagueUsers } = useLeagueUsers(selectedLeagueId);
  const { data: topic, isLoading: topicLoading } = useForumTopic(huddleId, topicId ?? null);
  const { data: replies = [] } = useForumReplies(huddleId, topicId ?? null);

  const deleteTopic = useDeleteTopic();
  const deleteReply = useDeleteReply();

  const canPost = huddleDetail?.myClaim?.status === "approved";
  const isCommissioner = huddleDetail?.huddle?.isCommissioner ?? false;

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

  async function handleDeleteTopic() {
    if (!topicId) return;
    await deleteTopic.mutateAsync({ huddleId: huddleId!, topicId });
    navigate("/league/forum");
  }

  async function handleDeleteReply(replyId: string) {
    if (!topicId) return;
    await deleteReply.mutateAsync({ huddleId: huddleId!, topicId, replyId });
  }

  const canDeleteTopic =
    !!topic && (isCommissioner || (topic.authorId === myClerkId && topic.replyCount === 0));

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-4">
      <Link
        to="/league/forum"
        className="inline-flex items-center gap-1.5 text-xs font-medium font-sans text-muted hover:text-ink transition-colors w-fit"
      >
        <ArrowLeft size={13} />
        Back to Forum
      </Link>

      {topicLoading ? (
        <p className="text-sm text-muted font-sans">Loading…</p>
      ) : !topic ? (
        <div className="py-10 text-center">
          <MessageSquare size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted font-sans">Topic not found — it may have been removed.</p>
        </div>
      ) : (
        <>
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-serif font-semibold text-lg text-ink leading-snug">{topic.title}</h1>
                <p className="mt-1 text-[11px] text-muted font-sans">
                  <span className="text-ink font-medium">{resolveName(topic.authorId)}</span> ·{" "}
                  {formatDateTime(topic.createdAt)}
                </p>
              </div>
              {canDeleteTopic && (
                <button
                  onClick={handleDeleteTopic}
                  disabled={deleteTopic.isPending}
                  className="shrink-0 text-muted hover:text-red-600 transition-colors disabled:opacity-40"
                  aria-label="Delete topic"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <p className="text-[13px] text-ink font-sans leading-relaxed whitespace-pre-wrap">{topic.body}</p>
          </Panel>

          {replies.length > 0 && (
            <Panel>
              <div className="flex flex-col">
                {replies.map((reply) => (
                  <ReplyRow
                    key={reply.id}
                    reply={reply}
                    authorName={resolveName(reply.authorId)}
                    canDelete={isCommissioner || reply.authorId === myClerkId}
                    onDelete={() => handleDeleteReply(reply.id)}
                  />
                ))}
              </div>
            </Panel>
          )}

          {canPost ? (
            <Panel>
              <ReplyComposer huddleId={huddleId} topicId={topic.id} />
            </Panel>
          ) : (
            <p className="text-[12px] text-muted font-sans">
              Only approved league members can reply. Claim your team to join the discussion.
            </p>
          )}
        </>
      )}
    </div>
  );
}
