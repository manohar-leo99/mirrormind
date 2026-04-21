import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tabs = [
  { href: "/dashboard/settings/integrations", label: "Connected Integrations" },
  { href: "/dashboard/settings/team", label: "Team Members" },
  { href: "/dashboard/settings", label: "Billing Plan" },
  { href: "/dashboard/settings", label: "Notifications" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-sm">Billing Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-primary/20 text-primary">
                  Starter Plan
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Upgrade to Growth for higher ingestion throughput and more
                  monthly queries.
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border bg-background">
              <CardHeader>
                <CardTitle className="text-sm">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>Daily sync summary: Enabled</p>
                <p>PR review alerts: Enabled</p>
                <p>Weekly usage digest: Enabled</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
