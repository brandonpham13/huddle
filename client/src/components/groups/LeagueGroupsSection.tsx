import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { useGroupsForLeague } from '../../hooks/useGroups'
import { CreateGroupModal } from './CreateGroupModal'

export function LeagueGroupsSection({ leagueId }: { leagueId: string }) {
  const { data: groups, isLoading } = useGroupsForLeague('sleeper', leagueId)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">
          Groups{groups && groups.length > 0 ? ` (${groups.length})` : ''}
        </span>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          Create group
        </Button>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {!isLoading && (groups?.length ?? 0) === 0 && (
        <p className="text-xs text-gray-400">No groups yet for this league.</p>
      )}

      {(groups?.length ?? 0) > 0 && (
        <div className="space-y-1">
          {groups!.map(g => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{g.name}</span>
              <Link
                to={`/groups/${g.id}`}
                className="text-xs font-medium text-blue-600 hover:underline shrink-0"
              >
                Open →
              </Link>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateGroupModal
          leagueId={leagueId}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
