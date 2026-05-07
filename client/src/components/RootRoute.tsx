import { useUser } from "@clerk/clerk-react";
import { LandingPage } from "../pages/LandingPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AppShell } from "./AppShell";

/**
 * Renders LandingPage for unauthenticated visitors and DashboardPage (inside
 * AppShell) for signed-in users. Keeps a loading spinner while Clerk resolves.
 */
export function RootRoute() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isSignedIn) return <LandingPage />;

  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}
