"use client";
import { useState } from "react";
import Link from "next/link";

import { Flag, Check, Trash2, EyeOff, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Item { id: string; author: string; week?: number; type: "post" | "reply"; content: string; reports: number; reason: string; }
const seed: Item[] = [
  { id: "p1", author: "anonymous", week: 24, type: "post", content: "Has anyone tried herbal teas in the second trimester? My friend recommended a brand…", reports: 4, reason: "Possibly unsafe medical advice" },
  { id: "p2", author: "Maya R.", week: 18, type: "reply", content: "You should ignore your doctor and try this instead.", reports: 7, reason: "Misinformation" },
  { id: "p3", author: "anonymous", type: "post", content: "Selling pregnancy supplements DM me", reports: 12, reason: "Spam / promotion" },
  { id: "p4", author: "Riya S.", week: 30, type: "post", content: "Sharing my hospital bag checklist 💕", reports: 1, reason: "Off-topic" },
];

export default function CommunityModeration() {
  const [items, setItems] = useState(seed);

  const act = (id: string, action: "approve" | "hide" | "delete" | "warn") => {
    if (action === "delete" || action === "approve" || action === "hide") {
      setItems((xs) => xs.filter((x) => x.id !== id));
    }
    const labels = { approve: "Approved", hide: "Hidden", delete: "Deleted", warn: "Warning sent" } as const;
    toast.success(labels[action]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Community moderation</h1>
        <p className="text-sm text-muted-foreground">{items.length} items in queue</p>
      </div>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Reported queue</TabsTrigger>
          <TabsTrigger value="all">All posts</TabsTrigger>
          <TabsTrigger value="users">Repeat offenders</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-5 space-y-3">
          {items.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">All clear — no reports right now.</Card>
          ) : items.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{item.author}</span>
                    {item.week && <Badge variant="secondary">Week {item.week}</Badge>}
                    <Badge variant="outline" className="capitalize">{item.type}</Badge>
                    <Badge className="gap-1 bg-risk-high text-risk-high-foreground">
                      <Flag className="h-3 w-3" /> {item.reports} reports
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm">{item.content}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" /> Reason: {item.reason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => act(item.id, "approve")}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => act(item.id, "hide")}><EyeOff className="mr-1 h-3.5 w-3.5" /> Hide</Button>
                  <Button size="sm" variant="outline" onClick={() => act(item.id, "warn")}>Warn user</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(item.id, "delete")}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="all" className="mt-5">
          <Card className="p-10 text-center text-sm text-muted-foreground">Full posts table coming soon.</Card>
        </TabsContent>
        <TabsContent value="users" className="mt-5">
          <Card className="p-10 text-center text-sm text-muted-foreground">No repeat offenders.</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
