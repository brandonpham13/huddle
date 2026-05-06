import { type ReactNode, useEffect } from 'react'
import { useUser, useAuth, RedirectToSignIn } from '@clerk/clerk-react'
import { useAppDispatch } from '../../store/hooks'
import { setUser, clearUser, setSleeperUsername } from '../../store/slices/authSlice'

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
      const sleeperUsername = (user.unsafeMetadata?.sleeperUsername as string) ?? null
      const sleeperUserId = (user.unsafeMetadata?.sleeperUserId as string) ?? null
      const syncedLeagueIds = (user.unsafeMetadata?.syncedLeagueIds as string[]) ?? []
      dispatch(setUser({
        id: user.id,
        username: user.username,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        sleeperUsername,
        sleeperUserId,
        syncedLeagueIds,
      }))
      dispatch(setSleeperUsername(sleeperUsername))
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

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  return <>{children}</>
}
