"use client";
import { useEffect, useMemo, useState } from "react";

import { Users, MessageSquare, BookOpen, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

type DashboardData = {
  totals: {
    users: number;
    activeThisWeek: number;
    communityPosts: number;
    ragDocuments: number;
  };
  deltas: {
    signupsWeekOverWeek: string;
  };
  signupsLast7Days: Array<{ day: string; value: number }>;
  symptomVolumeLast24Hours: Array<{ hour: string; value: number }>;
  activity: Array<{ who: string; what: string; at: string }>;
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard", { credentials: "include" });
        const j = (await res.json().catch(() => ({}))) as DashboardData & { message?: string };
        if (!res.ok) throw new Error(j.message ?? "Could not load dashboard");
        if (active) setData(j);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load dashboard");
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signupsData = useMemo(
    () => (data?.signupsLast7Days ?? []).map((d) => ({ day: d.day, v: d.value })),
    [data],
  );
  const symptomData = useMemo(
    () => (data?.symptomVolumeLast24Hours ?? []).map((d) => ({ h: d.hour, v: d.value })),
    [data],
  );

  const activity = data?.activity ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">An overview of your community and content.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={Users}
          label="Total users"
          value={loading ? "…" : `${data?.totals.users.toLocaleString() ?? 0}`}
          delta={loading ? "…" : data?.deltas.signupsWeekOverWeek ?? "0%"}
          tone="rose"
        />
        <KPI
          icon={TrendingUp}
          label="Active this week"
          value={loading ? "…" : `${data?.totals.activeThisWeek.toLocaleString() ?? 0}`}
          delta={loading ? "…" : `${Math.round(((data?.totals.activeThisWeek ?? 0) / Math.max(1, data?.totals.users ?? 1)) * 100)}%`}
          tone="sage"
        />
        <KPI
          icon={MessageSquare}
          label="Community posts"
          value={loading ? "…" : `${data?.totals.communityPosts.toLocaleString() ?? 0}`}
          delta={loading ? "…" : "All-time"}
          tone="rose"
        />
        <KPI
          icon={BookOpen}
          label="RAG documents"
          value={loading ? "…" : `${data?.totals.ragDocuments.toLocaleString() ?? 0}`}
          delta={loading ? "…" : "All-time"}
          tone="sage"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Signups · last 7 days</h2>
            <Badge variant="secondary">
              {loading ? "Loading…" : `${data?.deltas.signupsWeekOverWeek ?? "0%"} vs prev week`}
            </Badge>
          </div>
          <div className="h-64 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={signupsData}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Symptom logs volume</h2>
          <div className="h-64 w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={symptomData}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="h" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="v" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-base font-semibold">Recent activity</h2>
        <ul className="divide-y divide-border">
          {loading ? (
            <li className="py-3 text-sm text-muted-foreground">Loading activity…</li>
          ) : activity.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No recent activity yet.</li>
          ) : activity.map((a, i) => (
            <li key={i} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">— {a.what}</span></p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(a.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function KPI({ icon: Icon, label, value, delta, tone }: { icon: typeof Users; label: string; value: string; delta: string; tone: "rose" | "sage" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex items-center gap-0.5 text-xs font-medium text-accent">
          <ArrowUpRight className="h-3.5 w-3.5" /> {delta}
        </span>
      </div>
      <p className="mt-4 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
