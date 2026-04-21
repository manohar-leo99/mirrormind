type StreamingTextProps = {
  text: string;
  isStreaming?: boolean;
};

export function StreamingText({
  text,
  isStreaming = false,
}: StreamingTextProps) {
  return (
    <span>
      {text}
      {isStreaming ? (
        <span className="ml-0.5 animate-pulse text-primary">▍</span>
      ) : null}
    </span>
  );
}
