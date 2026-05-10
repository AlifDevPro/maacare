"use client";
import { useState } from "react";
import Link from "next/link";

import { Heart, MessageCircle, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TABS = ["Posts", "Questions", "Tips"] as const;

const FEED = [
  {
    user: "Aisha R.",
    avatar: "🌸",
    type: "Question" as const,
    week: 22,
    body: "Anyone else feeling baby kicks more at night? Is that normal?",
    likes: 24,
    comments: 8,
    verified: false,
  },
  {
    user: "Dr. Tasnim",
    avatar: "👩‍⚕️",
    type: "Tip" as const,
    week: null,
    body: "Adding iron-rich foods like spinach, lentils, and lean meat helps prevent pregnancy anemia. Pair with vitamin C for absorption.",
    likes: 142,
    comments: 12,
    verified: true,
  },
  {
    user: "Maya P.",
    avatar: "🌷",
    type: "Post" as const,
    week: 34,
    body: "Just finished my 34-week scan. Baby is head-down and growing well 🥹",
    likes: 89,
    comments: 21,
    verified: false,
  },
  {
    user: "Nadia K.",
    avatar: "🌺",
    type: "Question" as const,
    week: 12,
    body: "What helped you with morning sickness in the first trimester?",
    likes: 33,
    comments: 17,
    verified: false,
  },
];

export default function CommunityPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Posts");
  const filtered = tab === "Posts" ? FEED : FEED.filter((f) => f.type === tab.slice(0, -1));

  return (
    <AppShell>
      <AppHeader
        title="Community"
        right={
          <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="New post">
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-soft">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search posts, tips, people…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-2xl bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {filtered.map((p, i) => (
            <Link key={i} href={`/community/${i}`} className="block">
              <Card className="p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-base">
                    {p.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{p.user}</p>
                      {p.verified && (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {p.type}{p.week ? ` · Week ${p.week}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{p.body}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {p.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {p.comments}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card transition-transform hover:scale-105"
        aria-label="Create post"
      >
        <Plus className="h-6 w-6" />
      </button>
    </AppShell>
  );
}
