import { Button } from "@/components/ui/button";
import type { TeamMember, TeamRole } from "@/types/domain";

type TeamMemberListProps = {
  members: TeamMember[];
  onRoleChange: (userId: string, role: TeamRole) => void;
  onRemove: (userId: string) => void;
};

const roles: TeamRole[] = ["admin", "developer", "viewer"];

export function TeamMemberList({
  members,
  onRoleChange,
  onRemove,
}: TeamMemberListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Last Active</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-t border-border">
              <td className="px-4 py-3 text-foreground">{member.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {member.email}
              </td>
              <td className="px-4 py-3">
                <select
                  className="rounded-md border border-border bg-background px-2 py-1"
                  value={member.role}
                  onChange={(event) =>
                    onRoleChange(member.id, event.target.value as TeamRole)
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {member.lastActive ?? "-"}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemove(member.id)}
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
