import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const painPoints = [
  {
    before: "New developers take 3 months to onboard",
    after: "MirrorMind: 1 week",
  },
  {
    before: "Senior devs waste 2 hours/day answering questions",
    after: "MirrorMind answers them automatically",
  },
  {
    before: "Past mistakes get repeated",
    after: "MirrorMind warns before the mistake happens",
  },
];

const features = [
  {
    title: "MirrorChat",
    description: "AI answers grounded in YOUR code.",
  },
  {
    title: "MirrorReview",
    description: "Automated PR review in 60 seconds.",
  },
  {
    title: "Source Citations",
    description: "Every answer cites exact PR or commit.",
  },
  {
    title: "Team Privacy",
    description: "Your code never leaves your control.",
  },
];

const plans = [
  { name: "Starter", price: "$29", subtitle: "developer / month" },
  { name: "Growth", price: "$49", subtitle: "developer / month" },
  { name: "Enterprise", price: "Custom", subtitle: "pricing" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-[-20%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />

      <section className="relative mx-auto flex max-w-6xl flex-col gap-7 pb-20 pt-8">
        <p className="inline-flex w-fit rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary-foreground/90">
          Developer Team Intelligence
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground md:text-6xl">
          Your Team&apos;s AI Second Brain
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          MirrorMind reads your entire codebase history and gives every
          developer an AI assistant that knows exactly how YOUR team builds
          software.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            className="h-10 bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
            render={<Link href="/auth/signin" />}
          >
            Start Free Trial - Sign in with GitHub
          </Button>
          <span className="text-sm text-muted-foreground">
            14-day free trial. No credit card required.
          </span>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 pb-16 md:grid-cols-3">
        {painPoints.map((point) => (
          <Card
            key={point.before}
            className="glass-panel border border-border/70"
          >
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Pain Point
              </CardTitle>
              <CardDescription className="text-foreground">
                {point.before}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-primary">{point.after}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-4 pb-16 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="border border-border/70 bg-card/70"
          >
            <CardHeader>
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="relative mx-auto max-w-6xl pb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Pricing</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className="border border-border bg-card/70">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">
                    {plan.price}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {plan.subtitle}
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
