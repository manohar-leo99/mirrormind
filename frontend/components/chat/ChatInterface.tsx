"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSession } from "next-auth/react";

import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { SourceCitations } from "@/components/chat/SourceCitations";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api";
import { useConversationsQuery } from "@/lib/queries";
import type { ChatMessage, Citation, Conversation } from "@/types/domain";

function normalizeConversation(data: Conversation): Conversation {
  return {
    id: data.id,
    title: data.title || "Untitled conversation",
    updatedAt: data.updatedAt || new Date().toISOString(),
    messages: data.messages ?? [],
  };
}

export function ChatInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rawConversations = [], isLoading } = useConversationsQuery();
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<Citation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSources, setShowSources] = useState(true);

  const conversations = useMemo(
    () => rawConversations.map(normalizeConversation),
    [rawConversations],
  );

  const onSelectConversation = (conversationId: string) => {
    const selected = conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    setActiveConversationId(conversationId);
    setMessages(selected?.messages ?? []);
    const lastAssistant = [...(selected?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    setSources(lastAssistant?.citations ?? []);
  };

  const streamQuestion = async (
    question: string,
    conversationId: string | null,
  ) => {
    const session = await getSession();
    const response = await fetch(`${API_BASE_URL}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        question,
        conversationId,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Unable to stream response from backend.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    let receivedSources: Citation[] = [];

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const dataLines = chunk
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"));

        for (const line of dataLines) {
          const payload = line.replace("data:", "").trim();
          if (!payload) {
            continue;
          }

          try {
            const parsed = JSON.parse(payload) as {
              type: "token" | "done" | "error";
              content?: string;
              sources?: Citation[];
              error?: string;
            };

            if (parsed.type === "token" && parsed.content) {
              setMessages((current) => {
                const lastIndex = current.length - 1;
                if (lastIndex < 0) {
                  return current;
                }

                const last = current[lastIndex];
                if (last?.role !== "assistant") {
                  return current;
                }

                const updatedLast: ChatMessage = {
                  ...last,
                  content: `${last.content}${parsed.content}`,
                };

                return [...current.slice(0, lastIndex), updatedLast];
              });
            }

            if (parsed.type === "done") {
              receivedSources = parsed.sources ?? [];
            }

            if (parsed.type === "error") {
              setMessages((current) => {
                const lastIndex = current.length - 1;
                if (lastIndex < 0) {
                  return current;
                }

                const last = current[lastIndex];
                if (last?.role !== "assistant") {
                  return current;
                }

                if (last.content.trim().length > 0) {
                  return current;
                }

                const updatedLast: ChatMessage = {
                  ...last,
                  content:
                    "MirrorMind had trouble retrieving context. Here is a general best-effort answer. Re-sync ingestion for repo-specific details.",
                };

                return [...current.slice(0, lastIndex), updatedLast];
              });
            }
          } catch {
            continue;
          }
        }
      }
    }

    setMessages((current) => {
      const lastIndex = current.length - 1;
      if (lastIndex < 0) {
        return current;
      }

      const last = current[lastIndex];
      if (last?.role !== "assistant") {
        return current;
      }

      const updatedLast: ChatMessage = {
        ...last,
        content:
          last.content.trim().length > 0
            ? last.content
            : "MirrorMind could not produce a complete response this time. Please try again.",
        isStreaming: false,
        citations: receivedSources,
      };

      return [...current.slice(0, lastIndex), updatedLast];
    });
    setSources(receivedSources);
  };

  const onSend = async (content: string) => {
    const conversationId = activeConversationId ?? crypto.randomUUID();
    if (!activeConversationId) {
      setActiveConversationId(conversationId);
    }

    const timestamp = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: timestamp,
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: timestamp,
      isStreaming: true,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsStreaming(true);

    try {
      await streamQuestion(content, conversationId);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? {
                ...item,
                content:
                  "MirrorMind could not reach the backend service. Please try again.",
                isStreaming: false,
              }
            : item,
        ),
      );
      toast({
        title: "Streaming failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-7.5rem)] grid-cols-1 overflow-hidden rounded-lg border border-border bg-background xl:grid-cols-[250px_1fr_300px]">
      <div className="hidden xl:block">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
        />
      </div>

      <div className="flex min-h-0 flex-col">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            {isStreaming ? (
              <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground">
                <LoadingSpinner size="sm" />
                MirrorMind is analyzing your codebase...
              </div>
            ) : null}
            <ChatInput onSend={onSend} isLoading={isStreaming} />
          </>
        )}
      </div>

      <div className="hidden border-l border-border xl:block">
        <SourceCitations sources={sources} />
      </div>

      <div className="absolute bottom-3 right-3 xl:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSources((current) => !current)}
        >
          {showSources ? "Hide Sources" : "Show Sources"}
        </Button>
      </div>

      {showSources ? (
        <div className="fixed inset-x-4 bottom-16 z-50 max-h-[45vh] overflow-y-auto rounded-lg border border-border bg-card p-3 xl:hidden">
          <SourceCitations sources={sources} />
        </div>
      ) : null}
    </div>
  );
}
