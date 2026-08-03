import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export function SignUpPage() {
  const [params] = useSearchParams();
  // Carries an invite link's path through sign-up — see InviteLinkPage.tsx.
  const after = params.get("after") || "/";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignUp routing="path" path="/sign-up" afterSignUpUrl={after} />
    </div>
  );
}
