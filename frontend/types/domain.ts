export type TeamRole = "admin" | "developer" | "viewer";

export type IngestionState =
  | "Connected"
  | "Indexing"
  | "Error"
  | "Ready"
  | "Processing";

export type Citation = {
  id: string;
  url: string;
  type: "pull_request" | "commit" | "file" | string;
  author: string;
  preview: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  createdAt: string;
  isStreaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages?: ChatMessage[];
};

export type TeamInfo = {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  totalQueries?: number;
  prsReviewed?: number;
  teamMembers?: number;
  reposConnected?: number;
};

export type RepoConnection = {
  id: string;
  repoName: string;
  repoUrl: string;
  status: string;
  lastSyncedAt?: string;
  itemsIndexed?: number;
};

export type IngestionStatusItem = {
  repoId: string;
  repoName: string;
  status: IngestionState | string;
  itemsIndexed: number;
  lastSyncedAt?: string;
};

export type ActivityItem = {
  id: string;
  type: "query" | "review" | "repo" | string;
  text: string;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  lastActive?: string;
};

export type PullRequestReviewIssue = {
  severity: "info" | "warning" | "error";
  message: string;
  snippet?: string;
};

export type PullRequestItem = {
  id: string;
  title: string;
  author: string;
  repoName: string;
  openedAt: string;
  status: "Pending" | "Reviewing..." | "Reviewed" | "Approved" | string;
  prNumber: number;
  prUrl: string;
  summary?: string;
  issues?: PullRequestReviewIssue[];
};
