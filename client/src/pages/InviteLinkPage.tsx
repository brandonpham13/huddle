/**
 * InviteLinkPage — public landing page for a shareable, temporary invite
 * link.
 *
 * Route: /invite/:token — deliberately NOT wrapped in AuthGuard/AppShell,
 * since it has to work for someone who isn't signed in yet. Reuses
 * LandingPage.tsx's plain nav/hero/footer chrome rather than the
 * AppShell-internal Panel/Btn primitives.
 *
 * - Signed out: shows who they're invited to join, with sign-up/sign-in
 *   CTAs that carry this page's path forward via an `after` redirect param
 *   (see SignUpPage.tsx/SignInPage.tsx).
 * - Signed in: selects the league in Redux (same action JoinHuddleModal
 *   uses) and hands off to the existing team-claim picker at
 *   /league-settings — this page never creates a claim itself.
 */
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Button } from "../components/ui/button";
import { useInviteLinkLookup } from "../hooks/useHuddles";
import { useAppDispatch } from "../store/hooks";
import { setSelectedLeague } from "../store/slices/authSlice";

function Nav() {
  return (
    <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
      <Link to="/">
        <h1 className="text-xl font-bold">Huddle</h1>
      </Link>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="py-6 text-center text-xs text-gray-400">
      &copy; {new Date().getFullYear()} Huddle
    </footer>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Nav />
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function InviteLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: huddle, isLoading, isError } = useInviteLinkLookup(token ?? null);

  // Once signed in, select the league and hand off — dispatch and navigate
  // together in one effect so the redirect can't fire before the league is
  // actually selected.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !huddle) return;
    if (huddle.leagueId) {
      dispatch(setSelectedLeague(huddle.leagueId));
      navigate("/league-settings", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [isLoaded, isSignedIn, huddle, dispatch, navigate]);

  if (!token) {
    return (
      <Shell>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Invite link not found</h2>
        <Link to="/">
          <Button size="lg">Go to Huddle</Button>
        </Link>
      </Shell>
    );
  }

  if (isLoading || !isLoaded || isSignedIn) {
    // isSignedIn is included here too: once true, the effect above takes
    // over and redirects — this state is just a brief loading placeholder.
    return (
      <Shell>
        <p className="text-sm text-gray-500">Loading…</p>
      </Shell>
    );
  }

  if (isError || !huddle) {
    return (
      <Shell>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Invite link not valid</h2>
        <p className="text-gray-500 max-w-md mb-8">
          This invite link is invalid or has expired. Ask your commissioner for a new one.
        </p>
        <Link to="/">
          <Button size="lg">Go to Huddle</Button>
        </Link>
      </Shell>
    );
  }

  const afterParam = `?after=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <Shell>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        You're invited to join {huddle.name}
      </h2>
      <p className="text-gray-500 max-w-md mb-8">
        Sign up for Huddle to claim your team in this league.
      </p>
      <div className="flex items-center gap-3">
        <Link to={`/sign-up${afterParam}`}>
          <Button size="lg">Sign up to join</Button>
        </Link>
        <Link to={`/sign-in${afterParam}`}>
          <Button variant="outline" size="lg">
            I already have an account
          </Button>
        </Link>
      </div>
    </Shell>
  );
}
