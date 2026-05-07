import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import { useCreateGroup } from '../../hooks/useGroups'
import { useLeague, useLeagueRosters, useLeagueUsers } from '../../hooks/useSleeper'

export function CreateGroupModal({
  leagueId,
  onClose,
}: {
  leagueId: string
  onClose: () => void
}) {
  const { data: league } = useLeague(leagueId)
  const { data: rosters } = useLeagueRosters(leagueId)
  const { data: leagueUsers } = useLeagueUsers(leagueId)
  const create = useCreateGroup()
  const navigate = useNavigate()

  const [name, setName] = useState(league?.name ?? '')
  const [password, setPassword] = useState('')
  const [rosterId, setRosterId] = useState<number | null>(null)

  const canSubmit =
    name.trim().length > 0 && password.length >= 4 && !create.isPending

  const handleSubmit = () => {
    create.mutate(
      {
        leagueProvider: 'sleeper',
        leagueId,
        name: name.trim(),
        password,
        rosterId: rosterId ?? undefined,
      },
      {
        onSuccess: (group) => {
          onClose()
          navigate(`/groups/${group.id}`)
        },
      },
    )
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
          <h2 className="text-lg font-bold">Create group</h2>
          <p className="text-sm text-gray-500 mt-1">
            You'll be the commissioner. Members join by password and request a team — you approve.
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full text-sm border rounded-md px-2 py-1.5"
            placeholder={league?.name ?? 'Group name'}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Join password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            className="w-full text-sm border rounded-md px-2 py-1.5"
            placeholder="At least 4 characters"
          />
          <p className="text-[11px] text-gray-400 mt-1">Share this with your league out-of-band.</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Your team (optional)</label>
          <select
            value={rosterId ?? ''}
            onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">— Skip; claim later —</option>
            {(rosters ?? []).map((r) => {
              const owner = r.ownerId ? leagueUsers?.find((u) => u.userId === r.ownerId) : null
              const teamName = owner?.teamName ?? owner?.displayName ?? `Team ${r.rosterId}`
              return (
                <option key={r.rosterId} value={r.rosterId}>
                  {teamName}
                </option>
              )
            })}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Selecting a team auto-claims it for you.</p>
        </div>

        {create.isError && (
          <p className="text-xs text-red-500">{(create.error as Error).message}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? 'Creating…' : 'Create group'}
          </Button>
        </div>
      </div>
    </div>
  )
}
