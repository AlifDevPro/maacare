"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type MemberPost = {
  id: string;
  title: string | null;
  body: string;
  postKind: string;
  gestationalWeekSnapshot: number | null;
  createdAt: string;
};

type MemberProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  memberSince: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function kindLabel(kind: string): string {
  if (kind === "question") return "Question";
  if (kind === "tip") return "Tip";
  return "Post";
}

function avatarLetter(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export default function CommunityMemberPage() {
  const params = useParams();
  const { user } = useSession();
  const rawId = typeof params.userId === "string" ? params.userId : "";
  const validId = UUID_RE.test(rawId);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [posts, setPosts] = useState<MemberPost[]>([]);

  const load = useCallback(async () => {
    if (!validId) {
      setLoading(false);
      setProfile(null);
      setPosts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/community/members/${rawId}`, { credentials: "include" });
      if (res.status === 401) {
        toast.error("Please sign in.");
        setProfile(null);
        return;
      }
      if (res.status === 404) {
        setProfile(null);
        setPosts([]);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Could not load member");
      }
      const data = (await res.json()) as { profile: MemberProfile; posts: MemberPost[] };
      setProfile(data.profile);
      setPosts(data.posts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load member");
      setProfile(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [rawId, validId]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      void load();
    });
    return () => window.cancelAnimationFrame(id);
  }, [load]);

  if (!validId) {
    return (
      <AppShell>
        <AppHeader title="Member" showBack backHref="/community" showNotifications />
        <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
          Invalid profile link.{" "}
          <Link href="/community" className="font-medium text-primary">
            Back to community
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Member" showBack backHref="/community" showNotifications />
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <AppHeader title="Member" showBack backHref="/community" showNotifications />
        <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
          This member could not be found.{" "}
          <Link href="/community" className="font-medium text-primary">
            Back to community
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title={profile.displayName}
        showBack
        backHref="/community"
        showNotifications
        right={
          user?.id === profile.id ? (
            <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl px-2 text-xs font-semibold">
              <Link href="/profile">Manage profile</Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-4 px-4 pt-4 pb-28">
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xl font-semibold text-primary">
              {avatarLetter(profile.displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">{profile.displayName}</p>
              <p className="text-xs capitalize text-muted-foreground">{profile.role}</p>
              <p className="text-[11px] text-muted-foreground">
                Member since {formatDistanceToNow(new Date(profile.memberSince), { addSuffix: true })}
              </p>
            </div>
          </div>
        </Card>

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold">Community posts</h2>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public posts yet.</p>
          ) : (
            <div className="space-y-2">
              {posts.map((p) => (
                <Link key={p.id} href={`/community/${p.id}`} className="block">
                  <Card className="p-3 transition-colors hover:bg-muted/40">
                    <p className="text-[11px] text-muted-foreground">
                      {kindLabel(p.postKind)}
                      {p.gestationalWeekSnapshot != null ? ` · Week ${p.gestationalWeekSnapshot}` : ""}
                      {" · "}
                      {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </p>
                    {p.title ? (
                      <p className="mt-1 font-display text-sm font-semibold leading-snug">{p.title}</p>
                    ) : null}
                    <p className={cn("mt-0.5 text-sm text-foreground/90", p.title ? "line-clamp-2" : "line-clamp-3")}>
                      {p.body}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
