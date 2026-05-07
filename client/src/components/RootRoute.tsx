import { useUser } from "@clerk/clerk-react";
import { LandingPage } from "../pages/LandingPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AppShell } from "./AppShell";
import { AuthGuard } from "./auth/AuthGuard";

/**
 * Renders LandingPage for unauthenticated visitors and DashboardPage (inside
 * AppShell + AuthGuard) for signed-in users. AuthGuard handles the spinner and
 * ensures Redux is hydrated with user metadata before the dashboard mounts.
 */
export function RootRoute() {
  const { isLoaded, isSignedIn } = useUser();

  // Show spinner while Clerk loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isSignedIn) return <LandingPage />;

  // AuthGuard handles dispatching user metadata to Redux and waiting for
  // hydration before rendering — prevents the league query race condition.
  return (
    <AuthGuard>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </AuthGuard>
  );
}
