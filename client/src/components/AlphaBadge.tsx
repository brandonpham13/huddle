/**
 * AlphaBadge — persistent bottom-right indicator that the site is in
 * alpha. Mounted once in App.tsx as a sibling to <Routes> (not inside
 * AppShell) so it renders identically on every route, including public
 * pages like the landing/sign-in/invite-link pages.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function AlphaBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Huddle is in alpha"
          className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-xl shadow-md transition-transform hover:scale-105"
        >
          <span aria-hidden="true">🚧</span>
          <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[220px] text-center">
        Huddle is in alpha — some features may be incomplete or still in progress.
      </TooltipContent>
    </Tooltip>
  );
}
