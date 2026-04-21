"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const steps = [
  {
    title: "Welcome to MirrorMind",
    description:
      "MirrorMind learns from your code history and gives every team member instant project context.",
  },
  {
    title: "Connect GitHub",
    description: "Authorize GitHub and select 1-3 repositories for ingestion.",
  },
  {
    title: "Invite Your Team",
    description: "Invite teammates by email or skip for now.",
  },
  {
    title: "You're All Set!",
    description: "Kick off ingestion and open your dashboard.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [repoSelections, setRepoSelections] = useState<string[]>([]);
  const [invite, setInvite] = useState("");

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const toggleRepo = (repo: string) => {
    setRepoSelections((current) =>
      current.includes(repo)
        ? current.filter((item) => item !== repo)
        : [...current, repo].slice(0, 3),
    );
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full border border-border bg-card">
        <CardHeader>
          <p className="text-xs text-muted-foreground">
            Step {step + 1} of {steps.length}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <CardTitle className="text-xl">{steps[step].title}</CardTitle>
          <CardDescription>{steps[step].description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 0 ? (
            <p className="text-sm text-muted-foreground">
              MirrorMind indexes your commit and PR history so your team can ask
              precise technical questions with source citations.
            </p>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <Button variant="outline" onClick={() => signIn("github")}>
                Connect GitHub
              </Button>
              <div className="grid gap-2">
                {["acme/platform-api", "acme/web-app", "acme/devops"].map(
                  (repo) => (
                    <label
                      key={repo}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={repoSelections.includes(repo)}
                        onChange={() => toggleRepo(repo)}
                      />
                      {repo}
                    </label>
                  ),
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2">
              <Input
                placeholder="teammate@company.com"
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. You can invite more teammates later in Settings.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <p className="text-sm text-muted-foreground">
              Background ingestion will start after this step. You can track
              progress on the dashboard.
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              Back
            </Button>

            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((current) => current + 1)}>
                {step === 2 ? "Skip" : "Continue"}
              </Button>
            ) : (
              <Button onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
