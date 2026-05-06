import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Card, CardContent } from '../ui/card';

export function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <SignUp routing="path" path="/sign-up" />
        </CardContent>
      </Card>
    </div>
  );
}
