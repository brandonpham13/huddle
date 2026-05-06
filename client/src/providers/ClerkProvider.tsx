import React from 'react';
import { ClerkProvider as ClerkReactProvider } from '@clerk/clerk-react';

const publishableKey = process.env['REACT_APP_CLERK_PUBLISHABLE_KEY'];

interface ClerkProviderProps {
  children: React.ReactNode;
}

export function ClerkProvider({ children }: ClerkProviderProps) {
  if (!publishableKey) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">
            Missing <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> environment variable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkReactProvider publishableKey={publishableKey}>
      {children}
    </ClerkReactProvider>
  );
}
