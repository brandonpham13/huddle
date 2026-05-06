import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Card, CardContent } from '../ui/card';

export function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <SignIn routing="path" path="/sign-in" />
        </CardContent>
      </Card>
    </div>
  );
}
