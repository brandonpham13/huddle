import { type ReactNode, useEffect } from 'react'
import { useUser, useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import { useAppDispatch } from '../../store/hooks'
import { setUser, clearUser, setSleeperUsername, setSleeperUserId, setSyncedLeagueIds } from '../../store/slices/authSlice'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  const { isLoaded: authLoaded } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!isLoaded || !authLoaded) return

    if (isSignedIn && user) {
      const meta = user.unsafeMetadata ?? {}
      const sleeperUsername = (meta.sleeperUsername as string) ?? null
      const sleeperUserId = (meta.sleeperUserId as string) ?? null
      const syncedLeagueIds = (meta.syncedLeagueIds as string[]) ?? []

      dispatch(setUser({
        id: user.id,
        username: user.username,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        sleeperUsername,
        sleeperUserId,
        syncedLeagueIds,
      }))
      dispatch(setSleeperUsername(sleeperUsername))
      dispatch(setSleeperUserId(sleeperUserId))
      dispatch(setSyncedLeagueIds(syncedLeagueIds))
    } else {
      dispatch(clearUser())
    }
  }, [isLoaded, authLoaded, isSignedIn, user, dispatch])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!isSignedIn) return <RedirectToSignIn />

  return <>{children}</>
}
