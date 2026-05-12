import {
  Bell,
  BookOpen,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import { MermaidDiagram } from "@/components/docs/mermaid-diagram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const JOURNEY_CHART = `flowchart LR
  subgraph discover [Discover]
    L[Landing]
    D[Docs]
  end
  subgraph onboard [Onboard]
    S[Sign up]
    P[Profile]
  end
  subgraph daily [Daily use]
    H[Home]
    C[Chat]
    M[Community]
  end
  L --> S
  D --> S
  S --> P
  P --> H
  H --> C
  H --> M`;

const DATA_FLOW_CHART = `flowchart TB
  subgraph browser [Your browser]
    UI[Next.js UI]
  end
  subgraph edge [MaaCare server]
    API[API routes]
    AI[AI providers]
  end
  subgraph supa [Supabase]
    AUTH[Auth]
    DB[(Postgres + RLS)]
    RT[Realtime optional]
  end
  UI --> API
  API --> AUTH
  API --> DB
  UI --> RT
  API --> AI`;

const SAFE_CHAT_STEPS = [
  { step: 1, title: "Open Chat", body: "Use /chat from the bottom nav or home shortcuts.", icon: MessageCircle },
  { step: 2, title: "Add context", body: "Mention week, symptoms, or medications so answers stay relevant.", icon: HeartPulse },
  { step: 3, title: "Treat as educational", body: "Use output to prepare questions for your clinician—not as a diagnosis.", icon: Shield },
  { step: 4, title: "Escalate when unsure", body: "If something feels urgent, use local emergency services and your care team.", icon: Sparkles },
];

const SCREEN_CARDS = [
  {
    title: "App home",
    href: "/app",
    desc: "Shortcuts to chat, vitals, planner, and community.",
    icon: LayoutDashboard,
    tone: "from-rose-500/15 to-transparent",
  },
  {
    title: "AI chat",
    href: "/chat",
    desc: "Grounded answers with Bangla / English awareness.",
    icon: MessageCircle,
    tone: "from-violet-500/15 to-transparent",
  },
  {
    title: "Community",
    href: "/community",
    desc: "Posts, threaded replies, likes, and member cards.",
    icon: Users,
    tone: "from-emerald-500/15 to-transparent",
  },
  {
    title: "Notifications",
    href: "/notifications",
    desc: "Activity from replies, likes, and system messages.",
    icon: Bell,
    tone: "from-amber-500/15 to-transparent",
  },
  {
    title: "Emergency",
    href: "/emergency",
    desc: "Hotlines and safety-first guidance (public).",
    icon: MapPin,
    tone: "from-sky-500/15 to-transparent",
  },
  {
    title: "Documentation",
    href: "/docs",
    desc: "You are here—APIs, architecture, and guides.",
    icon: BookOpen,
    tone: "from-fuchsia-500/15 to-transparent",
  },
] as const;

export function VisualGuidesPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-3 border-b border-border/60 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Visual guides</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          See how MaaCare fits together
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Diagrams, screen map, and a safe chat checklist. Pair this page with the{" "}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/docs/user-guide">
            User guide
          </Link>{" "}
          for step-by-step prose.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">Product journey</h2>
          <p className="text-xs text-muted-foreground">From landing to daily habits</p>
        </div>
        <MermaidDiagram chart={JOURNEY_CHART} />
      </section>

      <Separator className="bg-border/60" />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">Where your data flows</h2>
          <p className="text-xs text-muted-foreground">High-level trust boundary</p>
        </div>
        <MermaidDiagram chart={DATA_FLOW_CHART} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Row Level Security in Postgres ensures each signed-in user only reads rows their policies allow. Admin APIs are
          additionally gated by role checks on the server.
        </p>
      </section>

      <Separator className="bg-border/60" />

      <section className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Key screens</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap a card to open the live route (sign-in may be required).</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCREEN_CARDS.map(({ title, href, desc, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="group block rounded-2xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full overflow-hidden border-border/70 bg-card/50 shadow-sm transition-all group-hover:border-primary/35 group-hover:shadow-md">
                <div className={`h-1.5 w-full bg-gradient-to-r ${tone}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <CardTitle className="font-display text-lg leading-tight group-hover:text-primary">{title}</CardTitle>
                      <CardDescription className="mt-1 text-sm leading-relaxed">{desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-primary">{href}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Separator className="bg-border/60" />

      <section className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Safe chat checklist</h2>
          <p className="mt-1 text-sm text-muted-foreground">A visual sequence you can follow every time.</p>
        </div>
        <ol className="space-y-5">
          {SAFE_CHAT_STEPS.map(({ step, title, body, icon: Icon }) => (
            <li key={step} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/35 bg-primary/10 text-sm font-bold text-primary">
                {step}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  <h3 className="font-display text-base font-semibold">{title}</h3>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
