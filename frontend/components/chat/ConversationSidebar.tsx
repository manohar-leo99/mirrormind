"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { Conversation } from "@/types/domain";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
};

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
}: ConversationSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return conversations;
    }

    const lowered = query.toLowerCase();
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(lowered),
    );
  }, [conversations, query]);

  return (
    <aside className="h-full w-full border-r border-border bg-card/50">
      <div className="border-b border-border p-3">
        <Input
          placeholder="Search conversations..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-2">
        {filtered.map((conversation) => {
          const active = conversation.id === activeConversationId;
          return (
            <button
              key={conversation.id}
              className={`mb-1 w-full rounded-md p-2 text-left text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <p className="line-clamp-1 font-medium">{conversation.title}</p>
              <p className="mt-1 text-xs opacity-80">
                {new Date(conversation.updatedAt).toLocaleString()}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
