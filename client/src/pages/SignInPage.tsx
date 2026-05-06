import { SignIn } from '@clerk/clerk-react'

export function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <SignIn routing="path" path="/sign-in" afterSignInUrl="/" />
    </div>
  )
}
