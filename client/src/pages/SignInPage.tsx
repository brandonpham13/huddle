import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export function SignInPage() {
  const [params] = useSearchParams();
  // Carries an invite link's path through sign-in — see InviteLinkPage.tsx.
  const after = params.get("after") || "/";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignIn routing="path" path="/sign-in" afterSignInUrl={after} />
    </div>
  );
}
