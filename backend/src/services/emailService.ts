type TeamInviteEmailPayload = {
  to: string;
  inviterName: string;
  teamName: string;
  inviteLink: string;
  role: "admin" | "developer" | "viewer";
};

export async function sendTeamInviteEmail(
  payload: TeamInviteEmailPayload,
): Promise<void> {
  // Placeholder for real provider integration (SendGrid, SES, Resend, etc).
  // This keeps API behavior complete while staying MVP-safe.
  console.info("[email] Team invite queued", payload);
}
