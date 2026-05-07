import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Huddle</h1>
        <div className="flex items-center gap-3">
          <Link to="/sign-in">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/sign-up">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Fantasy analytics for your league
        </h2>
        <p className="text-lg text-gray-500 max-w-md mb-8">
          Track standings, scores, and your league history. Connect your Sleeper
          leagues and get the stats that matter.
        </p>
        <div className="flex items-center gap-3">
          <Link to="/sign-up">
            <Button size="lg">Get started free</Button>
          </Link>
          <Link to="/sign-in">
            <Button variant="outline" size="lg">
              Sign in
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Huddle
      </footer>
    </div>
  );
}
