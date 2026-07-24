import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import axios, { AxiosError } from "axios";
import type { ForumTopic, ForumReply } from "../types/huddle";

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

/** Topics for a huddle's forum, most recently active first. */
export function useForumTopics(huddleId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["forum-topics", huddleId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ topics: ForumTopic[] }>(
        `/api/huddles/${huddleId}/forum/topics`,
        { headers: authHeader(token) },
      );
      return res.data.topics;
    },
    enabled: !!huddleId,
    staleTime: 60 * 1000,
  });
}

export function useCreateTopic() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; title: string; body: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ topic: ForumTopic }>(
          `/api/huddles/${input.huddleId}/forum/topics`,
          { title: input.title, body: input.body },
          { headers: authHeader(token) },
        );
        return res.data.topic;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to post topic"));
      }
    },
    onSuccess: (_topic, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forum-topics", variables.huddleId] });
    },
  });
}

/** A single topic (the opening post). */
export function useForumTopic(huddleId: string | null, topicId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["forum-topic", huddleId, topicId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ topic: ForumTopic }>(
        `/api/huddles/${huddleId}/forum/topics/${topicId}`,
        { headers: authHeader(token) },
      );
      return res.data.topic;
    },
    enabled: !!huddleId && !!topicId,
    staleTime: 30 * 1000,
  });
}

/** Replies to a topic, oldest first. */
export function useForumReplies(huddleId: string | null, topicId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["forum-replies", huddleId, topicId],
    queryFn: async () => {
      const token = await getToken();
      const res = await axios.get<{ replies: ForumReply[] }>(
        `/api/huddles/${huddleId}/forum/topics/${topicId}/replies`,
        { headers: authHeader(token) },
      );
      return res.data.replies;
    },
    enabled: !!huddleId && !!topicId,
    staleTime: 30 * 1000,
  });
}

export function useCreateReply() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; topicId: string; body: string }) => {
      const token = await getToken();
      try {
        const res = await axios.post<{ reply: ForumReply }>(
          `/api/huddles/${input.huddleId}/forum/topics/${input.topicId}/replies`,
          { body: input.body },
          { headers: authHeader(token) },
        );
        return res.data.reply;
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to post reply"));
      }
    },
    onSuccess: (_reply, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["forum-replies", variables.huddleId, variables.topicId],
      });
      queryClient.invalidateQueries({
        queryKey: ["forum-topic", variables.huddleId, variables.topicId],
      });
      queryClient.invalidateQueries({ queryKey: ["forum-topics", variables.huddleId] });
    },
  });
}

export function useDeleteTopic() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; topicId: string }) => {
      const token = await getToken();
      try {
        await axios.delete(
          `/api/huddles/${input.huddleId}/forum/topics/${input.topicId}`,
          { headers: authHeader(token) },
        );
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to remove topic"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forum-topics", variables.huddleId] });
    },
  });
}

export function useDeleteReply() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { huddleId: string; topicId: string; replyId: string }) => {
      const token = await getToken();
      try {
        await axios.delete(
          `/api/huddles/${input.huddleId}/forum/topics/${input.topicId}/replies/${input.replyId}`,
          { headers: authHeader(token) },
        );
      } catch (err) {
        throw new Error(errorMessage(err, "Failed to remove reply"));
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["forum-replies", variables.huddleId, variables.topicId],
      });
      queryClient.invalidateQueries({
        queryKey: ["forum-topic", variables.huddleId, variables.topicId],
      });
    },
  });
}
