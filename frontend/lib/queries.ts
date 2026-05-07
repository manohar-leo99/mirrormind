"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  connectRepo,
  disconnectRepo,
  getConnectedRepos,
  getConversations,
  getIngestionStatus,
  getPullRequests,
  getTeamInfo,
  getTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  syncRepo,
  triggerPRReview,
  updateTeamMemberRole,
} from "@/lib/api";

function shouldRetry(failureCount: number, error: Error) {
  const axiosError = error as Error & { response?: { status?: number } };
  const status = axiosError?.response?.status;
  if (status === 401 || status === 403) return false;
  return failureCount < 1;
}

export function useTeamQuery() {
  return useQuery({
    queryKey: ["team"],
    queryFn: getTeamInfo,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetry,
  });
}

export function useReposQuery() {
  return useQuery({
    queryKey: ["repos"],
    queryFn: getConnectedRepos,
    staleTime: 60 * 1000,
    retry: shouldRetry,
  });
}

export function useIngestionStatusQuery() {
  return useQuery({
    queryKey: ["ingestion-status"],
    queryFn: getIngestionStatus,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: shouldRetry,
  });
}

export function usePullRequestsQuery() {
  return useQuery({
    queryKey: ["pull-requests"],
    queryFn: getPullRequests,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: shouldRetry,
  });
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    staleTime: 2 * 60 * 1000,
    retry: shouldRetry,
  });
}

export function useTeamMembersQuery() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: getTeamMembers,
    staleTime: 30 * 1000,
    retry: shouldRetry,
  });
}

export function useConnectRepoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectRepo,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repos"] }),
        queryClient.invalidateQueries({ queryKey: ["ingestion-status"] }),
      ]);
    },
  });
}

export function useDisconnectRepoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectRepo,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repos"] }),
        queryClient.invalidateQueries({ queryKey: ["ingestion-status"] }),
      ]);
    },
  });
}

export function useSyncRepoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncRepo,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["repos"] }),
        queryClient.invalidateQueries({ queryKey: ["ingestion-status"] }),
      ]);
    },
  });
}

export function useTriggerPRReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerPRReview,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pull-requests"] });
    },
  });
}

export function useInviteTeamMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useUpdateTeamMemberRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateTeamMemberRole(userId, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useRemoveTeamMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeTeamMember,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}
