"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { format, formatDistanceToNow } from "date-fns";
import { Activity, Loader2, Shield, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CommunityPostBody } from "@/components/community/community-post-body";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type MemberPost = {
  id: string;
  title: string | null;
  body: string;
  bodyFormat?: "plain" | "html";
  postKind: string;
  gestationalWeekSnapshot: number | null;
  createdAt: string;
};

type ActivityItem = {
  kind: "post" | "comment";
  id: string;
  createdAt: string;
  body: string;
  title: string | null;
  postId: string;
  postTitle: string | null;
};

type MemberProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  memberSince: string;
  profession: string | null;
  professionLabel: string | null;
  language: string;
  languageLabel: string;
  communityShowExtendedProfile: boolean;
  verifiedProfessional: boolean;
  showExtendedToViewer: boolean;
  postCount: number;
  commentCount: number;
  pregnancy: {
    gestationalWeek: number | null;
    eddDate: string | null;
    pregnancyStatus: string | null;
  } | null;
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

function ProfileBadges({ profile }: { profile: MemberProfile }) {
  const chips: ReactNode[] = [];
  if (profile.role === "admin") {
    chips.push(
      <span
        key="admin"
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 shadow-[0_0_12px_rgba(245,158,11,0.35)] dark:text-amber-200"
      >
        <Shield className="h-3 w-3" />
        Admin
      </span>,
    );
  } else if (profile.role === "moderator") {
    chips.push(
      <span
        key="mod"
        className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800 shadow-[0_0_10px_rgba(139,92,246,0.25)] dark:text-violet-200"
      >
        Moderator
      </span>,
    );
  }

  const isDoctorBadge =
    profile.verifiedProfessional && profile.profession === "clinician";
  if (isDoctorBadge) {
    chips.push(
      <span
        key="doc"
        className="inline-flex items-center gap-1 rounded-full border border-sky-500/45 bg-sky-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 shadow-[0_0_14px_rgba(14,165,233,0.35)] dark:text-sky-100"
      >
        <Stethoscope className="h-3 w-3" />
        Verified doctor
      </span>,
    );
  }

  if (chips.length === 0) return null;
  return <div className="mt-2 flex flex-wrap gap-2">{chips}</div>;
}

export default function CommunityMemberPage() {
  const params = useParams();
  const { user } = useSession();
  const rawId = typeof params.userId === "string" ? params.userId : "";
  const validId = UUID_RE.test(rawId);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [posts, setPosts] = useState<MemberPost[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const load = useCallback(async () => {
    if (!validId) {
      setLoading(false);
      setProfile(null);
      setPosts([]);
      setActivity([]);
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
        setActivity([]);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? "Could not load member");
      }
      const data = (await res.json()) as {
        profile: MemberProfile;
        posts: MemberPost[];
        activity: ActivityItem[];
      };
      setProfile(data.profile);
      setPosts(data.posts ?? []);
      setActivity(data.activity ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load member");
      setProfile(null);
      setPosts([]);
      setActivity([]);
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

  const preg = profile.pregnancy;
  let joinedDateLabel: string | null = null;
  try {
    joinedDateLabel = format(new Date(profile.memberSince), "MMM d, yyyy");
  } catch {
    joinedDateLabel = null;
  }
  const hasPregnancyDetail =
    !!preg &&
    (preg.gestationalWeek != null ||
      (preg.eddDate != null && String(preg.eddDate).trim() !== "") ||
      (preg.pregnancyStatus != null && String(preg.pregnancyStatus).trim() !== ""));
  const showPregnancyBlock = profile.showExtendedToViewer && hasPregnancyDetail;
  const showExtendedOnCopy =
    profile.showExtendedToViewer && user?.id !== profile.id && !hasPregnancyDetail;

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
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 shrink-0 rounded-full border border-border/60 bg-primary-soft">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt="" className="rounded-full object-cover" />
              ) : null}
              <AvatarFallback className="rounded-full bg-primary-soft font-display text-xl font-semibold text-primary">
                {avatarLetter(profile.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">{profile.displayName}</p>
              <p className="text-[11px] text-muted-foreground">
                Member since {formatDistanceToNow(new Date(profile.memberSince), { addSuffix: true })}
                {joinedDateLabel ? ` · ${joinedDateLabel}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium tabular-nums text-foreground/85">
                  {profile.postCount ?? 0} posts
                </span>
                <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium tabular-nums text-foreground/85">
                  {profile.commentCount ?? 0} replies
                </span>
                <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium text-foreground/85">
                  {profile.languageLabel ?? (profile.language === "bn" ? "Bengali" : "English")}
                </span>
              </div>
              {profile.professionLabel ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Profession:</span> {profile.professionLabel}
                </p>
              ) : null}
              <ProfileBadges profile={profile} />
              {!profile.showExtendedToViewer && user?.id !== profile.id ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Pregnancy week details are hidden — this member has not enabled extended community profile.
                </p>
              ) : null}
              {showExtendedOnCopy ? (
                <p className="mt-2 rounded-lg border border-primary/25 bg-primary-soft/30 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
                  Extended community profile is on. Pregnancy week and due date will show here once they are saved in
                  pregnancy settings.
                </p>
              ) : null}
              {showPregnancyBlock ? (
                <div className="mt-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-xs">
                  <p className="font-semibold text-foreground/90">Pregnancy journey (shared with members)</p>
                  {preg?.gestationalWeek != null ? (
                    <p className="mt-1 text-muted-foreground">About week {preg.gestationalWeek}</p>
                  ) : null}
                  {preg?.eddDate ? (
                    <p className="text-muted-foreground">Due date {preg.eddDate}</p>
                  ) : null}
                  {preg?.pregnancyStatus ? (
                    <p className="mt-0.5 capitalize text-muted-foreground">Status: {preg.pregnancyStatus.replace(/_/g, " ")}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-0 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="posts"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 py-2 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
            >
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 py-2 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
            >
              <span className="inline-flex items-center justify-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                Activity
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-3 space-y-2">
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public posts yet.</p>
            ) : (
              posts.map((p) => (
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
                    <div className={cn("mt-0.5 text-sm text-foreground/90", p.title ? "line-clamp-2" : "line-clamp-3")}>
                      <CommunityPostBody body={p.body} bodyFormat={p.bodyFormat} />
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>
          <TabsContent value="activity" className="mt-3 space-y-2">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent community activity.</p>
            ) : (
              activity.map((a) => (
                <Link key={`${a.kind}-${a.id}`} href={`/community/${a.postId}`} className="block">
                  <Card className="p-3 transition-colors hover:bg-muted/40">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px] font-medium capitalize">
                        {a.kind}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {a.postTitle ? (
                      <p className="mt-1 text-xs font-medium text-foreground/90 line-clamp-1">On: {a.postTitle}</p>
                    ) : null}
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
