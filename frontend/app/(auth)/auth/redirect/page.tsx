"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function AuthRedirectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      if (session.user?.isNewUser) {
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    }

    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [router, session, status]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2">
      <LoadingSpinner />
      <span className="text-sm text-muted-foreground">
        Preparing your workspace...
      </span>
    </div>
  );
}
