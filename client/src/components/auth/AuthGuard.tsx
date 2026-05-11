/**
 * AuthGuard — gates every authenticated route in App.tsx.
 *
 * Responsibilities:
 *   1. Wait for Clerk to finish loading the session (spinner while loading).
 *   2. Redirect to /sign-in if the user isn't signed in.
 *   3. Mirror Clerk's user (including the Sleeper metadata we tuck into
 *      `unsafeMetadata`) into the Redux `auth` slice so the rest of the
 *      app can read it synchronously via `useAppSelector`.
 *   4. Hold render until Redux is hydrated — otherwise the first paint
 *      would fire queries with `sleeperUserId = null` and waste a
 *      no-op TanStack Query round-trip.
 *
 * Why `unsafeMetadata` and not a separate DB?
 *   Clerk lets us stash arbitrary JSON on the user record and read it back
 *   without an extra fetch. We use it for the Sleeper handle and the
 *   user's list of synced leagueIds — the data is small, user-owned, and
 *   non-sensitive. Anything bigger lives in our Postgres tables.
 *
 * IMPORTANT: After mutating `unsafeMetadata` on the server, always call
 * `await user.reload()` on the client to invalidate Clerk's cache —
 * otherwise the next `useUser()` read returns stale data and this guard
 * dispatches the old values into Redux.
 */
import { type ReactNode, useEffect } from "react";
import { useUser, useAuth, RedirectToSignIn } from "@clerk/clerk-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setUser, clearUser } from "../../store/slices/authSlice";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  const dispatch = useAppDispatch();
  const reduxUser = useAppSelector((state) => state.auth.user);

  // Keep Redux in lockstep with Clerk's user object. Fires on initial load
  // and again any time Clerk publishes an updated `user` (e.g. after the
  // app calls `user.reload()` post-metadata write).
  useEffect(() => {
    if (!isLoaded || !authLoaded) return;

    if (isSignedIn && user) {
      const meta = user.unsafeMetadata ?? {};
      dispatch(
        setUser({
          id: user.id,
          username: user.username,
          email: user.primaryEmailAddress?.emailAddress ?? "",
          sleeperUsername: (meta.sleeperUsername as string) ?? null,
          sleeperUserId: (meta.sleeperUserId as string) ?? null,
          syncedLeagueIds: (meta.syncedLeagueIds as string[]) ?? [],
        }),
      );
    } else {
      dispatch(clearUser());
    }
  }, [isLoaded, authLoaded, isSignedIn, user, dispatch]);

  if (!isLoaded || !authLoaded) {
    return <Spinner />;
  }

  if (!isSignedIn) return <RedirectToSignIn />;

  // Hold render until Redux is hydrated — prevents queries firing with null sleeperUserId.
  // Without this we'd briefly mount children with `useAppSelector(...)` returning the
  // initial state, which would cause every Sleeper hook to fire its `enabled: !!id` guard
  // twice (once with null, once with the real id once Redux catches up).
  if (!reduxUser) return <Spinner />;

  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );
}
