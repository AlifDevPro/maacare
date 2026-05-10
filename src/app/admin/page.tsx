"use client";
import Link from "next/link";

import { Users, MessageSquare, BookOpen, TrendingUp, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";

const signupsData = [
  { day: "Mon", v: 42 }, { day: "Tue", v: 58 }, { day: "Wed", v: 64 },
  { day: "Thu", v: 51 }, { day: "Fri", v: 78 }, { day: "Sat", v: 92 }, { day: "Sun", v: 86 },
];
const chatData = [
  { h: "00", v: 12 }, { h: "04", v: 6 }, { h: "08", v: 48 }, { h: "12", v: 76 },
  { h: "16", v: 92 }, { h: "20", v: 58 },
];
const activity = [
  { who: "Nusrat A.", what: "Created an account", when: "2m ago" },
  { who: "Sara K.", what: "Posted in Community", when: "8m ago" },
  { who: "Maya R.", what: "Asked the AI about fatigue", when: "15m ago" },
  { who: "Riya S.", what: "Reported a post", when: "31m ago" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">An overview of your community and content.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Users} label="Total users" value="12,438" delta="+12%" tone="rose" />
        <KPI icon={TrendingUp} label="Active this week" value="3,201" delta="+8%" tone="sage" />
        <KPI icon={MessageSquare} label="Community posts" value="1,847" delta="+24%" tone="rose" />
        <KPI icon={BookOpen} label="RAG documents" value="312" delta="+3" tone="sage" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Signups · last 7 days</h2>
            <Badge variant="secondary">+18% vs prev week</Badge>
          </div>
          <div className="h-64 w-full">
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
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold">AI chat volume</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={chatData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="h" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="v" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-base font-semibold">Recent activity</h2>
        <ul className="divide-y divide-border">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">— {a.what}</span></p>
              </div>
              <span className="text-xs text-muted-foreground">{a.when}</span>
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
