import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type {
  SurveySummary,
  SurveyDetail,
  SurveyResults,
  NewSurveyInput,
  SurveyAnswerInput,
} from "../types/huddle";

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

/** Surveys for a huddle, newest first. */
export function useSurveys(huddleId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["surveys", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ surveys: SurveySummary[] }>(
        `/api/huddles/${huddleId}/surveys`,
        { headers: authHeader(token) },
      );
      return res.data.surveys;
    },
    enabled: !!huddleId,
    staleTime: 30 * 1000,
  });
}

export function useCreateSurvey() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; survey: NewSurveyInput }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ survey: SurveyDetail }>(
          `/api/huddles/${input.huddleId}/surveys`,
          input.survey,
          { headers: authHeader(token) },
        );
        return res.data.survey;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to create survey"));
      }
    },
    onSuccess: (_survey, variables) => {
      queryClient.invalidateQueries({ queryKey: ["surveys", variables.huddleId] });
    },
  });
}

export function useUpdateSurvey() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; surveyId: string; survey: NewSurveyInput }) => {
      const token = await getToken();
      try {
        const res = await axios.put<{ survey: SurveyDetail }>(
          `/api/huddles/${input.huddleId}/surveys/${input.surveyId}`,
          input.survey,
          { headers: authHeader(token) },
        );
        return res.data.survey;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update survey"));
      }
    },
    onSuccess: (_survey, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey", variables.huddleId, variables.surveyId] });
      queryClient.invalidateQueries({ queryKey: ["surveys", variables.huddleId] });
      queryClient.invalidateQueries({
        queryKey: ["survey-results", variables.huddleId, variables.surveyId],
      });
    },
  });
}

/** A single survey — questions/options plus the caller's own answers, if any. */
export function useSurvey(huddleId: string | null, surveyId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["survey", huddleId, surveyId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ survey: SurveyDetail }>(
        `/api/huddles/${huddleId}/surveys/${surveyId}`,
        { headers: authHeader(token) },
      );
      return res.data.survey;
    },
    enabled: !!huddleId && !!surveyId,
    staleTime: 15 * 1000,
  });
}

export function useSubmitSurveyResponse() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; surveyId: string; answers: SurveyAnswerInput[] }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ survey: SurveyDetail }>(
          `/api/huddles/${input.huddleId}/surveys/${input.surveyId}/responses`,
          { answers: input.answers },
          { headers: authHeader(token) },
        );
        return res.data.survey;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to submit response"));
      }
    },
    onSuccess: (_survey, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey", variables.huddleId, variables.surveyId] });
      queryClient.invalidateQueries({ queryKey: ["surveys", variables.huddleId] });
      queryClient.invalidateQueries({
        queryKey: ["survey-results", variables.huddleId, variables.surveyId],
      });
    },
  });
}

/** Aggregated results — only resolves for commissioners, or members once published. */
export function useSurveyResults(huddleId: string | null, surveyId: string | null, enabled = true) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["survey-results", huddleId, surveyId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ results: SurveyResults }>(
        `/api/huddles/${huddleId}/surveys/${surveyId}/results`,
        { headers: authHeader(token) },
      );
      return res.data.results;
    },
    enabled: !!huddleId && !!surveyId && enabled,
    staleTime: 15 * 1000,
  });
}

export function useSetResultsPublished() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; surveyId: string; resultsPublished: boolean }) => {
      const token = await getToken();
      try {
        await axios.patch(
          `/api/huddles/${input.huddleId}/surveys/${input.surveyId}`,
          { resultsPublished: input.resultsPublished },
          { headers: authHeader(token) },
        );
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to update results visibility"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey", variables.huddleId, variables.surveyId] });
      queryClient.invalidateQueries({ queryKey: ["surveys", variables.huddleId] });
      queryClient.invalidateQueries({
        queryKey: ["survey-results", variables.huddleId, variables.surveyId],
      });
    },
  });
}

export function useDeleteSurvey() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; surveyId: string }) => {
      const token = await getToken();
      try {
        await axios.delete(`/api/huddles/${input.huddleId}/surveys/${input.surveyId}`, {
          headers: authHeader(token),
        });
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to delete survey"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["surveys", variables.huddleId] });
    },
  });
}
