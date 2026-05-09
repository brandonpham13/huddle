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
