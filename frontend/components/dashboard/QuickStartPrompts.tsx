import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickStartPromptsProps = {
  prompts: string[];
  onPromptSelect: (prompt: string) => void;
};

export function QuickStartPrompts({
  prompts,
  onPromptSelect,
}: QuickStartPromptsProps) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">Quick Start</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal text-left"
            onClick={() => onPromptSelect(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
