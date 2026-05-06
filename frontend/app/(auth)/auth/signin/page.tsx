"use client";

import { useEffect } from "react";
import { GitBranch } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function SignInPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(session?.user?.isNewUser ? "/onboarding" : "/dashboard");
    }
  }, [router, session?.user?.isNewUser, status]);

  if (status !== "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background px-4">
        <LoadingSpinner />
        <span className="text-sm text-muted-foreground">
          Preparing your sign-in session...
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In to MirrorMind</CardTitle>
          <CardDescription>
            Use your GitHub account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => signIn("github", { callbackUrl: "/auth/redirect" })}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Sign in with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
