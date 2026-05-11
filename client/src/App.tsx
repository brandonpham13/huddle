/**
 * Top-level route table.
 *
 * Route layers (outermost to innermost):
 *   1. `<BrowserRouter>`        — react-router-dom history provider
 *   2. `<AccountModalProvider>` — context for the global Account modal so any
 *                                  page can `useAccountModal().open()`
 *   3. `<Routes>`               — the actual route map
 *
 * Public routes (no auth required):
 *   - `/sign-in/*`, `/sign-up/*` — Clerk's hosted auth pages
 *
 * `RootRoute` (mounted at `/`) decides where to send a signed-in user:
 * usually `DashboardPage` inside AppShell, but it can also bounce to
 * `/leagues` for users who haven't synced any leagues yet.
 *
 * `/account` and `/settings` are aliased back to `/` because Clerk used to
 * deep-link to them — we now surface them through the AccountModal instead
 * of full pages.
 *
 * The nested route block at the bottom is the "authenticated app". The
 * `<AuthGuard>` wrapper redirects to /sign-in if Clerk reports no session;
 * `<AppShell>` then renders the persistent nav + sidebar around the
 * matched child route's `<Outlet />`.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { RootRoute } from "./components/RootRoute";
import { AppShell } from "./components/AppShell";
import { AccountModalProvider } from "./components/AccountModal";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { LeaguesPage } from "./pages/LeaguesPage";
import { HuddleDetailPage } from "./pages/HuddleDetailPage";
import { TeamPage } from "./pages/TeamPage";
import { LeaguePage } from "./pages/LeaguePage";
import { SchedulePage } from "./pages/SchedulePage";
import { DraftPage } from "./pages/DraftPage";

export default function App() {
  return (
    <BrowserRouter>
      <AccountModalProvider>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/" element={<RootRoute />} />
          {/* Account/settings are surfaced via the AccountModal now;
              redirect any lingering deep links back to the dashboard. */}
          <Route path="/account" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />

          {/* Auth-protected routes inside AppShell. AuthGuard enforces a
              valid Clerk session; AppShell wraps each child with the
              persistent top nav + Sidebar. */}
          <Route
            element={
              <AuthGuard>
                <AppShell />
              </AuthGuard>
            }
          >
            <Route path="/league" element={<LeaguePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/draft" element={<DraftPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/huddles/:id" element={<HuddleDetailPage />} />
            <Route path="/teams/:rosterId" element={<TeamPage />} />
          </Route>
        </Routes>
      </AccountModalProvider>
    </BrowserRouter>
  );
}
