"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/chat": "MirrorChat",
  "/dashboard/review": "MirrorReview",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/integrations": "Integrations",
  "/dashboard/settings/team": "Team Members",
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const title = useMemo(() => {
    if (!pathname) {
      return "Dashboard";
    }

    return titles[pathname] ?? "MirrorMind";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <Sidebar currentPath={pathname ?? "/dashboard"} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header title={title} user={session?.user} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
