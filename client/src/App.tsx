import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { RootRoute } from "./components/RootRoute";
import { AppShell } from "./components/AppShell";
import { AccountModalProvider } from "./components/AccountModal";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { LeaguesPage } from "./pages/LeaguesPage";
import { HuddleDetailPage } from "./pages/HuddleDetailPage";
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
          <Route path="/account" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />

          {/* Auth-protected routes inside AppShell */}
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
          </Route>
        </Routes>
      </AccountModalProvider>
    </BrowserRouter>
  );
}
