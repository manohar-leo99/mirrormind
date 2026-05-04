"use client";

import ReactMarkdown from "react-markdown";

import { CodeBlock } from "@/components/ui/CodeBlock";
import type { ChatMessage } from "@/types/domain";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-lg border p-3 text-sm leading-relaxed shadow-sm md:max-w-[80%] ${
          isUser
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <>
            <ReactMarkdown
              components={{
                code(props) {
                  const { children, className } = props;
                  const match = /language-(\w+)/.exec(className ?? "");
                  const value = String(children).replace(/\n$/, "");
                  const inline = !(
                    className && className.includes("language-")
                  );

                  if (inline) {
                    return (
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock code={value} language={match?.[1] ?? "text"} />
                  );
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>;
                },
                h1({ children }) {
                  return (
                    <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">
                      {children}
                    </h1>
                  );
                },
                h2({ children }) {
                  return (
                    <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">
                      {children}
                    </h2>
                  );
                },
                h3({ children }) {
                  return (
                    <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">
                      {children}
                    </h3>
                  );
                },
                ul({ children }) {
                  return (
                    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                      {children}
                    </ul>
                  );
                },
                ol({ children }) {
                  return (
                    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                      {children}
                    </ol>
                  );
                },
                li({ children }) {
                  return <li className="leading-relaxed">{children}</li>;
                },
                strong({ children }) {
                  return <strong className="font-semibold">{children}</strong>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming ? (
              <span className="ml-0.5 animate-pulse text-primary">▍</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
