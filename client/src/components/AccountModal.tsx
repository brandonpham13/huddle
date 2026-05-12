/**
 * AccountModal — the global "Account" overlay accessible from the top nav.
 *
 * Architecture:
 *   - `AccountModalProvider` (mounted high up in App.tsx) owns the
 *     `isOpen` state and renders the actual modal on top of the page.
 *   - `useAccountModal()` is the hook any component uses to open/close.
 *     It throws if you call it outside the provider, which is intentional
 *     — it's a hard error if a route forgets to wrap its tree.
 *
 * The modal embeds Clerk's `<UserProfile>` plus our own integrations
 * section (currently: connect/disconnect Sleeper account), and provides
 * a link out to /leagues for league-sync management.
 *
 * Why a context instead of route params?
 *   The "Account" entry point is in AppShell's top nav which is reused on
 *   every authenticated page, so plumbing open/close state through every
 *   route would be noisy. Context lets the trigger live anywhere.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { UserProfile, useAuth, useUser } from "@clerk/clerk-react";
import { ChevronRight } from "lucide-react";
import { Plug, X } from "lucide-react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setSyncedLeagueIds,
  setSelectedLeague,
} from "../store/slices/authSlice";
import { Button } from "./ui/button";

interface AccountModalContextValue {
  isOpen: boolean;
  open: (tab?: string) => void;
  close: () => void;
}

const AccountModalContext = createContext<AccountModalContextValue | null>(
  null,
);

export function useAccountModal() {
  const ctx = useContext(AccountModalContext);
  if (!ctx)
    throw new Error(
      "useAccountModal must be used inside <AccountModalProvider>",
    );
  return ctx;
}

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  const open = useCallback((tab?: string) => {
    setInitialTab(tab);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setInitialTab(undefined);
  }, []);

  return (
    <AccountModalContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen && <AccountModal onClose={close} initialTab={initialTab} />}
    </AccountModalContext.Provider>
  );
}

function AccountModal({ onClose, initialTab }: { onClose: () => void; initialTab?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Navigate to the requested tab by clicking the matching nav button after
  // Clerk's UserProfile has rendered its nav items.
  useEffect(() => {
    if (!initialTab) return;
    const attempt = (retries: number) => {
      const navButtons = document.querySelectorAll<HTMLElement>(
        "[data-localization-key], .cl-navbarButton, [class*='navbarButton']",
      );
      for (const btn of navButtons) {
        if (btn.textContent?.trim().toLowerCase() === initialTab.toLowerCase()) {
          btn.click();
          return;
        }
      }
      // Clerk renders async — retry a few times with a short delay
      if (retries > 0) setTimeout(() => attempt(retries - 1), 80);
    };
    setTimeout(() => attempt(5), 100);
  }, [initialTab]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative mt-10 mb-10 max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center hover:bg-gray-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <UserProfile
          routing="virtual"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "rounded-xl shadow-xl w-full",
              pageScrollBox: "p-6",
            },
          }}
        >
          <UserProfile.Page
            label="Integrations"
            url="integrations"
            labelIcon={<Plug className="w-4 h-4" />}
          >
            <IntegrationsPage />
          </UserProfile.Page>
        </UserProfile>
      </div>
    </div>
  );
}

function IntegrationsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const sleeperUsername = useAppSelector(
    (state) => state.auth.user?.sleeperUsername,
  );
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const patchSleeperUsername = async (value: string | null) => {
    const token = await getToken();
    const res = await axios.patch<{
      sleeperUsername: string | null;
      sleeperUserId: string | null;
    }>(
      "/api/user/sleeper-username",
      { sleeperUsername: value },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  };

  const handleLink = async () => {
    if (!input.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await patchSleeperUsername(input.trim());
      // Reload Clerk user — AuthGuard's useEffect will re-hydrate Redux with fresh metadata
      await user?.reload();
      setInput("");
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Something went wrong");
      } else {
        setErrorMsg("Something went wrong");
      }
    }
  };

  const handleUnlink = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      await patchSleeperUsername(null);
      // Immediately clear UI state — don't wait for the Clerk reload
      dispatch(setSyncedLeagueIds([]));
      dispatch(setSelectedLeague(null));
      queryClient.removeQueries({ queryKey: ["sleeper-leagues-all"] });
      // Sync Clerk cache so AuthGuard re-hydrates with cleared metadata
      await user?.reload();
      setStatus("idle");
    } catch (err: unknown) {
      setStatus("error");
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Failed to unlink account");
      } else {
        setErrorMsg("Failed to unlink account");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Integrations</h1>
        <p className="text-sm text-gray-500">
          Connect external platforms to power your dashboard.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
            S
          </div>
          <span className="text-sm font-medium">Sleeper</span>
          {sleeperUsername && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Connected
            </span>
          )}
        </div>

        {sleeperUsername && (
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-800">
              <strong>{sleeperUsername}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={status === "loading"}
              onClick={handleUnlink}
            >
              Unlink
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLink()}
            placeholder={
              sleeperUsername ? "Change username" : "Sleeper username"
            }
            className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <Button
            onClick={handleLink}
            disabled={status === "loading" || !input.trim()}
            size="sm"
          >
            {status === "loading" ? "…" : sleeperUsername ? "Update" : "Link"}
          </Button>
        </div>

        {status === "success" && (
          <p className="text-xs text-green-600">Sleeper account linked!</p>
        )}
        {status === "error" && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}

        {sleeperUsername && (
          <Link
            to="/leagues"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Manage synced leagues
            <ChevronRight size={14} />
          </Link>
        )}
      </div>

      <div className="pt-2 border-t">
        <p className="text-xs text-gray-400">More integrations coming soon.</p>
      </div>
    </div>
  );
}
