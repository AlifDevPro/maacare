"use client";
import Link from "next/link";

import { Heart, MessageCircle, Send } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COMMENTS = [
  { user: "Sara", avatar: "🌷", body: "Yes! Mine is super active around 9pm 😅", time: "2h" },
  { user: "Lina", avatar: "🌸", body: "Totally normal — my doctor said babies often follow opposite of mom's activity.", time: "3h" },
  { user: "Rehana", avatar: "🌺", body: "Same here at week 24!", time: "5h" },
];

export default function PostDetail() {
  return (
    <AppShell>
      <AppHeader title="Post" showBack />
      <div className="space-y-4 px-4 pt-4 pb-32">
        <Card className="p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft">🌸</span>
            <div>
              <p className="text-sm font-semibold">Aisha R.</p>
              <p className="text-[11px] text-muted-foreground">Question · Week 22 · 4h ago</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed">
            Anyone else feeling baby kicks more at night? Is that normal? Sometimes I can't sleep at all because of how active baby gets after 10pm.
          </p>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <button className="flex items-center gap-1.5 hover:text-primary">
              <Heart className="h-4 w-4" /> 24
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {COMMENTS.length}
            </span>
          </div>
        </Card>

        <h2 className="font-display text-sm font-semibold">Replies</h2>
        <div className="space-y-2.5">
          {COMMENTS.map((c, i) => (
            <Card key={i} className="flex gap-2.5 p-3 shadow-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">{c.avatar}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{c.user}</p>
                  <span className="text-[11px] text-muted-foreground">{c.time}</span>
                </div>
                <p className="text-sm text-foreground/90">{c.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 70px)" }}
      >
        <form className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
          <input
            placeholder="Add a kind reply…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="icon" className="h-9 w-9 rounded-xl" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
