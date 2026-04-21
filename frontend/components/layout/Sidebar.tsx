"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Home, MessageSquare, Settings, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarProps = {
  currentPath: string;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/chat", label: "MirrorChat", icon: MessageSquare },
  { href: "/dashboard/review", label: "MirrorReview", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ currentPath }: SidebarProps) {
  const { data: session } = useSession();

  return (
    <aside className="hidden h-screen w-[250px] shrink-0 border-r border-border bg-[#1E3A5F]/40 p-4 md:flex md:flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/20 p-2 text-primary">
          <Image
            src="/mirrormind-logo.svg"
            alt="MirrorMind logo"
            width={20}
            height={20}
            className="h-5 w-5"
          />
        </div>
        <div>
          <p className="text-sm font-semibold">MirrorMind</p>
          <p className="text-xs text-muted-foreground">
            {session?.user?.name ?? "Developer Team"}
          </p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            currentPath === item.href ||
            currentPath.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Team Workspace</p>
        <p className="mt-1">Private code intelligence for your team.</p>
      </div>
    </aside>
  );
}
