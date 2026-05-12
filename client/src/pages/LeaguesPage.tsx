import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAccountModal } from "../components/AccountModal";
import { useAppSelector } from "../store/hooks";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { HuddlesSection } from "../components/huddles/HuddlesSection";

export function LeaguesPage() {
  const { open: openAccountModal } = useAccountModal();
  const sleeperUsername = useAppSelector(
    (state) => state.auth.user?.sleeperUsername,
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="bg-chrome border-b border-line px-6 py-4 flex items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft size={14} />
          Dashboard
        </Link>
        <h1 className="text-xl font-bold text-ink">Huddles</h1>
      </nav>

      <main className="p-6 max-w-2xl mx-auto space-y-4">
        {!sleeperUsername && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">
                Connect your Sleeper account so you can link a league to your
                huddle.
              </p>
              <Button onClick={() => openAccountModal("integrations")}>
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Huddles</CardTitle>
            <CardDescription>
              Create a huddle, invite your league members, then link a Sleeper
              league from inside the huddle to unlock the full dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HuddlesSection />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
