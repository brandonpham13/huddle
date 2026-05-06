import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser, clearUser } from '../../store/slices/authSlice';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      dispatch(clearUser());
      navigate('/sign-in');
      return;
    }

    if (user) {
      dispatch(
        setUser({
          id: user.id,
          username: user.username ?? user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
        })
      );
    }
  }, [isLoaded, isSignedIn, user, dispatch, navigate]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isSignedIn) return null;

  return <>{children}</>;
}
