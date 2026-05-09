import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ClerkProvider } from "@clerk/clerk-react";
import { TooltipProvider } from "../components/ui/tooltip";
import { ThemeProvider } from "../context/ThemeContext";
import { store } from "../store";

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
