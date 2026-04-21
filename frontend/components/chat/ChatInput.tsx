"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ChatInputProps = {
  onSend: (message: string) => Promise<void>;
  isLoading: boolean;
};

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setValue("");
    await onSend(trimmed);
  };

  return (
    <div className="border-t border-border bg-card p-3">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Ask MirrorMind about your codebase..."
        className="h-24 w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary"
        disabled={isLoading}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
        <Button
          onClick={() => void submit()}
          disabled={isLoading || !value.trim()}
        >
          {isLoading ? "Generating..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
