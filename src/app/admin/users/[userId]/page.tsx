"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2, MailCheck, ShieldBan } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { invalidateByPrefix } from "@/lib/client/request-cache";

import { AdminUserDetailSkeleton } from "./admin-user-detail-skeleton";

type Role = "user" | "moderator" | "admin";

type AdminUserDetail = {
  auth: {
    id: string;
    email: string | null;
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
    bannedUntil: string | null;
    createdAt: string | null;
  };
  profile: {
    id: string;
    email: string | null;
    display_name: string | null;
    role: Role;
    language: string | null;
    created_at: string;
    profession: string | null;
    verified_professional: boolean | null;
    community_show_extended_profile: boolean | null;
    admin_note: string | null;
    ban_reason: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  recentPosts: { id: string; title: string | null; body: string; created_at: string; moderation_status: string }[];
  recentComments: {
    id: string;
    body: string;
    created_at: string;
    post_id: string;
    moderation_status: string;
  }[];
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = typeof params.userId === "string" ? params.userId : "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [profession, setProfession] = useState<string>("");
  const [verifiedProfessional, setVerifiedProfessional] = useState(false);
  const [communityExtended, setCommunityExtended] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [banReason, setBanReason] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!rawId) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${rawId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as AdminUserDetail & { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not load user");
      setData(j);
      const p = j.profile;
      if (p) {
        setDisplayName(p.display_name?.trim() ?? "");
        setLanguage(p.language === "bn" ? "bn" : "en");
        setProfession(p.profession ?? "");
        setVerifiedProfessional(!!p.verified_professional);
        setCommunityExtended(!!p.community_show_extended_profile);
        setAdminNote(p.admin_note ?? "");
        setRole(p.role);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load user");
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    if (!rawId) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/admin/users/${rawId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          language,
          profession: profession.trim() || null,
          verifiedProfessional,
          communityShowExtendedProfile: communityExtended,
          adminNote: adminNote.trim() || null,
          role,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Save failed");
      toast.success("Saved");
      invalidateByPrefix("admin:users?");
      await load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function confirmEmail() {
    if (!rawId) return;
    setAuthBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${rawId}/confirm-email`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not confirm email");
      toast.success("Email marked confirmed");
      await load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm email");
    } finally {
      setAuthBusy(false);
    }
  }

  async function setBanned(banned: boolean) {
    if (!rawId) return;
    setAuthBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${rawId}/ban`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned, reason: banReason.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Could not update ban");
      toast.success(banned ? "User banned" : "Ban lifted");
      invalidateByPrefix("admin:users?");
      await load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update ban");
    } finally {
      setAuthBusy(false);
    }
  }

  if (loading) {
    return <AdminUserDetailSkeleton />;
  }

  if (!data?.profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="h-4 w-4" /> Users
        </Button>
        <p className="text-sm text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const banned = !!data.auth.bannedUntil && new Date(data.auth.bannedUntil) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" /> Users
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {data.profile.display_name?.trim() || "Member"}
        </h1>
        <p className="text-sm text-muted-foreground">{data.auth.email ?? data.profile.email ?? "—"}</p>
        {banned ? (
          <p className="mt-1 text-xs font-medium text-destructive">Account is currently banned.</p>
        ) : null}
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Auth</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Email confirmed</span>
            <p>{data.auth.emailConfirmedAt ? formatDistanceToNow(new Date(data.auth.emailConfirmedAt), { addSuffix: true }) : "No"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last sign-in</span>
            <p>
              {data.auth.lastSignInAt
                ? formatDistanceToNow(new Date(data.auth.lastSignInAt), { addSuffix: true })
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Joined</span>
            <p>
              {data.auth.createdAt
                ? formatDistanceToNow(new Date(data.auth.createdAt), { addSuffix: true })
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={authBusy} onClick={() => void confirmEmail()}>
            <MailCheck className="mr-2 h-4 w-4" />
            Approve email (confirm)
          </Button>
          {!banned ? (
            <Button type="button" variant="destructive" size="sm" disabled={authBusy} onClick={() => void setBanned(true)}>
              <ShieldBan className="mr-2 h-4 w-4" />
              Ban user
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={authBusy} onClick={() => void setBanned(false)}>
              Lift ban
            </Button>
          )}
        </div>
        {!banned ? (
          <div className="grid gap-2 pt-2">
            <Label htmlFor="ban-reason">Ban reason (shown in email if Resend configured)</Label>
            <Textarea id="ban-reason" rows={2} value={banReason} onChange={(e) => setBanReason(e.target.value)} className="rounded-xl" />
          </div>
        ) : null}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-base font-semibold">Profile (editable)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="bn">Bangla</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Profession (community)</Label>
            <Select value={profession || "none"} onValueChange={(v) => setProfession(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                <SelectItem value="parent_caregiver">Parent / caregiver</SelectItem>
                <SelectItem value="clinician">Clinician</SelectItem>
                <SelectItem value="student_researcher">Student / researcher</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Switch id="vp" checked={verifiedProfessional} onCheckedChange={setVerifiedProfessional} />
            <Label htmlFor="vp">Verified professional (doctor badge)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ce" checked={communityExtended} onCheckedChange={setCommunityExtended} />
            <Label htmlFor="ce">Extended community profile (week summary)</Label>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="an">Internal admin note</Label>
          <Textarea id="an" rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="rounded-xl" />
        </div>
        <Button type="button" disabled={savingProfile} onClick={() => void saveProfile()}>
          {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Recent community posts</h2>
        {data.recentPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.recentPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="font-medium text-primary hover:underline">
                  {p.title?.trim() || p.body.slice(0, 48)}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  · {p.moderation_status} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">Recent comments</h2>
        {data.recentComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.recentComments.map((c) => (
              <li key={c.id}>
                <Link href={`/community/${c.post_id}`} className="text-primary hover:underline">
                  View thread
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  · {c.moderation_status} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
                <p className="line-clamp-2 text-muted-foreground">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
