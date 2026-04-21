"use client";

import { useState } from "react";

import { TeamMemberList } from "@/components/dashboard/TeamMemberList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  useInviteTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useTeamMembersQuery,
  useUpdateTeamMemberRoleMutation,
} from "@/lib/queries";
import type { TeamRole } from "@/types/domain";

export default function TeamSettingsPage() {
  const { toast } = useToast();
  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersError,
    error: membersQueryError,
    refetch: refetchMembers,
  } = useTeamMembersQuery();
  const inviteMutation = useInviteTeamMemberMutation();
  const updateRoleMutation = useUpdateTeamMemberRoleMutation();
  const removeMutation = useRemoveTeamMemberMutation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("developer");
  const membersErrorMessage =
    membersQueryError instanceof Error
      ? membersQueryError.message
      : "Could not load team members.";

  const onInvite = async () => {
    if (!email.trim()) {
      return;
    }

    try {
      await inviteMutation.mutateAsync({ email, role });
      toast({
        title: "Invitation sent",
        description: `${email} has been invited.`,
      });
      setEmail("");
    } catch (error) {
      toast({
        title: "Failed to invite member",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Invite Team Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="teammate@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={role}
            onChange={(event) => setRole(event.target.value as TeamRole)}
          >
            <option value="admin">admin</option>
            <option value="developer">developer</option>
            <option value="viewer">viewer</option>
          </select>
          <Button
            onClick={() => void onInvite()}
            disabled={inviteMutation.isPending}
          >
            Send Invite
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading team members...
            </p>
          ) : membersError ? (
            <div className="space-y-2">
              <p className="text-sm text-red-400">
                Failed to load team members: {membersErrorMessage}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchMembers()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <TeamMemberList
              members={members}
              onRoleChange={(userId, newRole) => {
                void updateRoleMutation.mutateAsync({ userId, role: newRole });
              }}
              onRemove={(userId) => {
                void removeMutation.mutateAsync(userId);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
