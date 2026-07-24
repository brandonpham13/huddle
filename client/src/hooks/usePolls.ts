import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type { Poll, NewPollInput } from "../types/huddle";

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message ?? fallback;
  }
  return fallback;
}

/** The huddle's current active dashboard poll, or null if none is set. */
export function useDashboardPoll(huddleId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["dashboard-poll", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ poll: Poll | null }>(
        `/api/huddles/${huddleId}/dashboard-poll`,
        { headers: authHeader(token) },
      );
      return res.data.poll;
    },
    enabled: !!huddleId,
    staleTime: 30 * 1000,
  });
}

/** Commissioner: replace the huddle's active dashboard poll. */
export function useSetDashboardPoll() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string } & NewPollInput) => {
      const token = await getToken();
      try {
        const res = await axios.put<{ poll: Poll }>(
          `/api/huddles/${input.huddleId}/dashboard-poll`,
          {
            question: input.question,
            options: input.options,
            allowMultiple: input.allowMultiple,
            allowVoteChanges: input.allowVoteChanges,
            resultsVisibility: input.resultsVisibility,
          },
          { headers: authHeader(token) },
        );
        return res.data.poll;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to save poll"));
      }
    },
    onSuccess: (_poll, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-poll", variables.huddleId] });
    },
  });
}

/** Vote (or change vote) on the huddle's dashboard poll. */
export function useVoteOnDashboardPoll() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; pollId: string; optionIds: string[] }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ poll: Poll }>(
          `/api/huddles/${input.huddleId}/dashboard-poll/vote`,
          { pollId: input.pollId, optionIds: input.optionIds },
          { headers: authHeader(token) },
        );
        return res.data.poll;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to vote"));
      }
    },
    onSuccess: (_poll, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-poll", variables.huddleId] });
    },
  });
}
