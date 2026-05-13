/**
 * Announcements widget — news-feed of commissioner announcements for the
 * currently-selected huddle. Renders null when there's no huddle linked
 * to the selected league, or when the huddle has no announcements yet.
 *
 * Placement: above the 3-column grid in DashboardPage, between
 * MyTeamSection and the grid.
 */
import { useSelectedLeagueHuddle, useAnnouncements } from "../../hooks/useHuddles";
import { SectionHead } from "./_shared";
import type { HuddleAnnouncement } from "../../types/huddle";

// ---- Single announcement card ----

function AnnouncementCard({ item }: { item: HuddleAnnouncement }) {
  const date = new Date(item.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="border-b border-line last:border-b-0 py-3 first:pt-0 last:pb-0">
      {/* Dateline eyebrow */}
      <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
        {date}
      </p>
      {/* Title */}
      <h3 className="font-serif text-[15px] text-ink leading-snug mb-1">
        {item.title}
      </h3>
      {/* Body — clamp long posts to 4 lines on the dashboard */}
      <p className="text-[12.5px] text-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
        {item.body}
      </p>
    </div>
  );
}

// ---- Container ----

/** Inner component: receives a resolved huddle ID and fetches + renders. */
function AnnouncementsFeed({ huddleId }: { huddleId: string }) {
  const { data: announcements } = useAnnouncements(huddleId);

  // Don't render anything until data is available, or when empty
  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="border border-line rounded-lg p-5 bg-paper">
      <SectionHead kicker="FROM THE COMMISSIONER" title="Announcements" rule={null} />
      <div className="mt-3">
        {announcements.map((a) => (
          <AnnouncementCard key={a.id} item={a} />
        ))}
      </div>
    </div>
  );
}

// ---- Public widget ----

/**
 * Looks up the huddle linked to the currently-selected league and renders
 * announcements. Returns null when there's no matching huddle or no posts.
 */
export function Announcements() {
  const huddle = useSelectedLeagueHuddle();
  if (!huddle) return null;
  return <AnnouncementsFeed huddleId={huddle.id} />;
}
