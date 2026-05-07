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

  // Hold render until Redux is hydrated — prevents queries firing with null sleeperUserId
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
