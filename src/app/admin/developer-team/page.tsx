"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Loader2, Sparkles, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Member = {
  userId: string;
  cardDisplayName: string | null;
  jobTitle: string;
  bio: string;
  photoUrl: string | null;
  socialGithub: string | null;
  socialTwitter: string | null;
  socialLinkedin: string | null;
  socialWebsite: string | null;
  sortOrder: number;
  published: boolean;
  /** Developer-controlled; when false they stay off the public team section even if published. */
  showOnTeamSection: boolean;
  createdAt: string;
  profileDisplayName: string | null;
  profileEmail: string | null;
  profileAvatarUrl: string | null;
};

type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
};

async function patchMember(userId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/developer-team/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(j.message ?? "Update failed");
}

type DeveloperMemberRowProps = {
  member: Member;
  onTogglePublished: (userId: string, next: boolean) => void;
  onSortBlur: (userId: string, raw: string) => void;
  onRemove: (userId: string) => void;
};

const DeveloperMemberRow = memo(function DeveloperMemberRow({
  member: m,
  onTogglePublished,
  onSortBlur,
  onRemove,
}: DeveloperMemberRowProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            {m.cardDisplayName?.trim() || m.profileDisplayName || "Unnamed"}{" "}
            <span className="text-muted-foreground">· {m.profileEmail ?? m.userId}</span>
          </p>
          <p className="text-sm text-muted-foreground">{m.jobTitle || "—"}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{m.bio || "—"}</p>
          {!m.showOnTeamSection ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Not listed publicly — developer opted out of the team section.
            </p>
          ) : null}
          <Button asChild variant="link" className="h-auto px-0 text-xs">
            <Link href={`/admin/users/${m.userId}`}>Open in Users</Link>
          </Button>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <div className="flex items-center gap-2">
            <Label htmlFor={`pub-${m.userId}`} className="text-xs text-muted-foreground">
              Published
            </Label>
            <Switch
              id={`pub-${m.userId}`}
              checked={m.published}
              onCheckedChange={(v) => onTogglePublished(m.userId, v)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`so-${m.userId}`} className="text-xs text-muted-foreground">
              Sort order
            </Label>
            <Input
              id={`so-${m.userId}`}
              key={`${m.userId}-${m.sortOrder}`}
              type="number"
              className="h-9 w-24"
              defaultValue={m.sortOrder}
              onBlur={(e) => onSortBlur(m.userId, e.target.value)}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onRemove(m.userId)}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export default function AdminDeveloperTeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [emailQuery, setEmailQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/developer-team", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { members?: Member[]; message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not load");
      setMembers(j.members ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = emailQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&limit=8`, {
            credentials: "include",
            cache: "no-store",
          });
          const j = (await res.json().catch(() => ({}))) as { users?: AdminUserRow[]; message?: string };
          if (!res.ok) throw new Error(j.message ?? "Search failed");
          setSearchResults(j.users ?? []);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Search failed");
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [emailQuery]);

  async function addMemberByUserId(userId: string) {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/developer-team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not add");
      toast.success("Team member added");
      setEmailQuery("");
      setSearchResults([]);
      await load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  const togglePublished = useCallback(async (userId: string, next: boolean) => {
    let prevPublished = false;
    let found = false;
    setMembers((list) =>
      list.map((x) => {
        if (x.userId !== userId) return x;
        found = true;
        prevPublished = x.published;
        return { ...x, published: next };
      }),
    );
    if (!found) return;
    try {
      await patchMember(userId, { published: next });
      toast.success(next ? "Published" : "Unpublished");
      void load({ silent: true });
    } catch (e) {
      setMembers((list) => list.map((x) => (x.userId === userId ? { ...x, published: prevPublished } : x)));
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }, [load]);

  const updateSort = useCallback(async (userId: string, raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    let prevOrder = 0;
    let found = false;
    setMembers((list) =>
      list.map((x) => {
        if (x.userId !== userId) return x;
        found = true;
        prevOrder = x.sortOrder;
        return { ...x, sortOrder: n };
      }),
    );
    if (!found) return;
    try {
      await patchMember(userId, { sortOrder: n });
      void load({ silent: true });
    } catch (e) {
      setMembers((list) => list.map((x) => (x.userId === userId ? { ...x, sortOrder: prevOrder } : x)));
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }, [load]);

  const removeMember = useCallback(async (userId: string) => {
    if (!confirm("Remove this person from the team directory?")) return;
    let snapshot: Member[] = [];
    setMembers((list) => {
      snapshot = list;
      return list.filter((x) => x.userId !== userId);
    });
    try {
      const res = await fetch(`/api/admin/developer-team/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Delete failed");
      toast.success("Removed");
      void load({ silent: true });
    } catch (e) {
      setMembers(snapshot);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }, [load]);

  async function suggestOrder() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/developer-team/suggest-order", {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { orderedUserIds?: string[]; message?: string; note?: string };
      if (!res.ok) throw new Error(j.message ?? "Suggest failed");
      const order = j.orderedUserIds ?? [];
      if (order.length === 0) {
        toast.message(j.note ?? "Nothing to order");
        return;
      }
      setApplying(true);
      const r2 = await fetch("/api/admin/developer-team/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedUserIds: order }),
      });
      const j2 = (await r2.json().catch(() => ({}))) as { message?: string };
      if (!r2.ok) throw new Error(j2.message ?? "Could not apply order");
      toast.success("Order updated from AI suggestion");
      await load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setSuggesting(false);
      setApplying(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Developer team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control who appears on the public landing page, display order, and publish state.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add team member</CardTitle>
          <CardDescription>
            Search by email or name, pick a user, then add. They can edit their public card under{" "}
            <span className="font-mono text-xs">/developer</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="email-q">Search users</Label>
            <Input
              id="email-q"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Type email or display name…"
              autoComplete="off"
            />
          </div>
          {emailQuery.trim().length >= 2 ? (
            <div className="relative min-h-[2.75rem] rounded-lg border border-border/80 bg-muted/30">
              {searching && searchResults.length > 0 ? (
                <div
                  className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm"
                  aria-live="polite"
                >
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  <span>Updating</span>
                </div>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className={cn("divide-y divide-border/60", searching && "opacity-75")}>
                  {searchResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={adding}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
                        onClick={() => void addMemberByUserId(u.id)}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{u.display_name?.trim() || "Unnamed"}</span>
                          <span className="block break-all text-muted-foreground">{u.email ?? u.id}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-background/80 px-2 py-0.5 text-xs capitalize text-muted-foreground">
                          {u.role ?? "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 text-sm text-muted-foreground">
                  {searching ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Searching…
                    </span>
                  ) : (
                    "No matches."
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Enter at least two characters to search.</p>
          )}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5 shrink-0" /> Click a row to add that user to the directory.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" disabled={suggesting || members.length < 2} onClick={() => void suggestOrder()} className="gap-2">
          {(suggesting || applying) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Suggest order with AI & apply
        </Button>
        <p className="text-xs text-muted-foreground">
          Uses job titles and bios to propose leadership-first ordering, then saves sort order.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members yet.</p>
      ) : (
        <div className="space-y-4">
          {members.map((m) => (
            <DeveloperMemberRow
              key={m.userId}
              member={m}
              onTogglePublished={togglePublished}
              onSortBlur={updateSort}
              onRemove={removeMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
