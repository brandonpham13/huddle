import { useUser } from "@clerk/clerk-react";
import { LandingPage } from "../pages/LandingPage";
import { DashboardPage } from "../pages/DashboardPage";

/**
 * Renders LandingPage for unauthenticated visitors and DashboardPage for
 * signed-in users. Keeps a loading spinner while Clerk resolves auth state.
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

  return isSignedIn ? <DashboardPage /> : <LandingPage />;
}
