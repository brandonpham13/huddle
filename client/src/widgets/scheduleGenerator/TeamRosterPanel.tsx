/**
 * TeamRosterPanel — shows the teams that will be scheduled.
 *
 * Auto-populated from the selected league's rosters (owner-facing decision:
 * this tool is not freeform like ffschedulemaker.com's manual team entry —
 * it always schedules the currently-selected Huddle league). List order is
 * whatever the league gives us (by rosterId) — it isn't editable, since
 * `generateSchedule()` shuffles the team list internally before running the
 * round-robin algorithm, so display order has zero effect on the result.
 * Members can still add a placeholder "bye" team to force an odd-team-count
 * style week off, which is otherwise handled automatically.
 *
 * Capped at `MAX_TEAMS` — the "Add placeholder team" button disables itself
 * at the cap, and if the league itself has more rosters than that, the page
 * passes `truncatedFromLeague` so this panel can say why the list is short.
 */
import { Plus, X } from "lucide-react";
import { Panel, PanelHeader, Btn } from "./_shared";
import { MAX_TEAMS, type GeneratorTeam } from "../../utils/scheduleGenerator";

export function TeamRosterPanel({
  teams,
  onAddPlaceholder,
  onRemovePlaceholder,
  truncatedFromLeague,
}: {
  teams: GeneratorTeam[];
  onAddPlaceholder: () => void;
  onRemovePlaceholder: (id: string) => void;
  truncatedFromLeague?: boolean;
}) {
  const isOdd = teams.length % 2 === 1;
  const atMax = teams.length >= MAX_TEAMS;

  return (
    <Panel>
      <PanelHeader
        title="Teams"
        description={`${teams.length} team${teams.length === 1 ? "" : "s"} pulled from the selected league.${
          isOdd ? " Odd team count — one team gets a bye each week." : ""
        }`}
        subtitle={`Supports up to ${MAX_TEAMS} teams.`}
      />
      {truncatedFromLeague && (
        <p className="text-[11.5px] font-sans text-yellow-800 dark:text-yellow-300 -mt-2">
          This league has more than {MAX_TEAMS} teams — only the first {MAX_TEAMS} are shown.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {teams.map((team) => (
          <div
            key={team.id}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-line bg-paper"
          >
            {team.avatar ? (
              <img
                src={`https://sleepercdn.com/avatars/thumbs/${team.avatar}`}
                alt=""
                className="w-5 h-5 rounded-full shrink-0 object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-line shrink-0" />
            )}
            <span className="flex-1 text-[13px] font-sans text-ink truncate">
              {team.name}
              {team.rosterId === null && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">
                  placeholder
                </span>
              )}
            </span>
            {team.rosterId === null && (
              <button
                onClick={() => onRemovePlaceholder(team.id)}
                aria-label="Remove placeholder team"
                className="p-1 text-muted hover:text-red-600 shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-[12.5px] text-muted font-sans">
            No rosters found for the selected league yet.
          </p>
        )}
      </div>

      <Btn onClick={onAddPlaceholder} disabled={atMax}>
        <Plus size={13} />
        {atMax ? `Max ${MAX_TEAMS} teams` : "Add placeholder team"}
      </Btn>
    </Panel>
  );
}
