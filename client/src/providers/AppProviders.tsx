/**
 * AppProviders — assembles the global provider stack mounted in main.tsx.
 *
 * Order matters: providers that produce values consumed by others must
 * wrap them. The current stack (outer → inner):
 *
 *   ThemeProvider           — light/dark mode CSS variable swap
 *     ClerkProvider         — auth session + user object
 *       Redux <Provider>    — `auth` slice, persistence layer (store/index.ts)
 *         QueryClientProvider — TanStack Query cache (and devtools)
 *           TooltipProvider — Radix tooltip portal/positioning
 *             {children}    — Routes/App
 *
 * Clerk has to wrap Redux because AuthGuard reads from Clerk and dispatches
 * into Redux. Redux has to wrap TanStack Query because most query hooks
 * read `selectedLeagueId` etc. out of Redux to derive their query keys.
 */
import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ClerkProvider } from "@clerk/clerk-react";
import { TooltipProvider } from "../components/ui/tooltip";
import { ThemeProvider } from "../context/ThemeContext";
import { store } from "../store";

// Single QueryClient for the whole app. Individual hooks override
// staleTime per query when they need a different cache window (see the
// stale-time table in `hooks/useSleeper.ts`).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const CLERK_PUBLISHABLE_KEY = import.meta.env
  .VITE_CLERK_PUBLISHABLE_KEY as string;

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">
          Missing VITE_CLERK_PUBLISHABLE_KEY env var
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </Provider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
