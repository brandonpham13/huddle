/**
 * Sign-out helper that keeps Redux + Clerk in sync.
 *
 * Clerk owns the actual session/cookie, but our Redux `auth` slice mirrors
 * a snapshot of the user for fast synchronous reads (Sidebar, top nav).
 * We clear Redux *first* so any reactive UI immediately reflects the
 * signed-out state, then ask Clerk to drop the session (which usually
 * triggers a redirect to the sign-in page via the Clerk provider).
 */
import { useClerk } from "@clerk/clerk-react";
import { useAppDispatch } from "../store/hooks";
import { clearUser } from "../store/slices/authSlice";

export function useSignOut() {
  const { signOut: clerkSignOut } = useClerk();
  const dispatch = useAppDispatch();

  const signOut = async () => {
    dispatch(clearUser());
    await clerkSignOut();
  };

  return { signOut };
}
