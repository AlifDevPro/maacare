"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Camera,
  Calendar,
  Heart,
  Globe,
  Bell,
  Download,
  LogOut,
  ChevronRight,
  Pencil,
  Loader2,
  Users,
} from "lucide-react";

import type { ProfileBundle } from "@/app/profile/profile-types";
import type { PublicUser } from "@/lib/auth/types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { SmartHealthNudge } from "@/components/app/smart-health-nudge";
import { ProfileAvatarUploadDialog } from "@/components/profile/profile-avatar-upload-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatIsoDate } from "@/lib/profile/computed";
import { refreshSession, signOut, updateUserLanguage, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const PREFS_KEY = "maacare:notification-prefs";

type Prefs = { dailyReminders: boolean; communityNotifications: boolean };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { dailyReminders: true, communityNotifications: true };
    return { ...{ dailyReminders: true, communityNotifications: true }, ...JSON.parse(raw) };
  } catch {
    return { dailyReminders: true, communityNotifications: true };
  }
}

function savePrefs(p: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export function ProfilePageClient({
  session,
  initialBundle,
}: {
  session: PublicUser;
  initialBundle: ProfileBundle;
}) {
  const { t } = useTranslation("health");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { user } = useSession();
  const [bundle, setBundle] = useState(initialBundle);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({
    dailyReminders: true,
    communityNotifications: true,
  });

  useEffect(() => {
    setBundle(initialBundle);
  }, [initialBundle]);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const [communityExtended, setCommunityExtended] = useState(false);

  useEffect(() => {
    const p = bundle?.profile;
    if (!p) return;
    setCommunityExtended(!!p.community_show_extended_profile);
    const local = loadPrefs();
    const next: Prefs = {
      dailyReminders:
        typeof p.notify_daily_reminders === "boolean" ? p.notify_daily_reminders : local.dailyReminders,
      communityNotifications:
        typeof p.notify_community_activity === "boolean"
          ? p.notify_community_activity
          : local.communityNotifications,
    };
    setPrefs(next);
    savePrefs(next);
  }, [bundle]);

  function refreshFromServer() {
    startTransition(() => {
      router.refresh();
    });
  }

  function initials(name: string) {
    return (
      name
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"
    );
  }

  async function exportData() {
    try {
      const res = await fetch("/api/profile/export-summary", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(j.message ?? "Could not export data");
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const day = new Date().toISOString().slice(0, 10);
      a.download = `maacare-health-summary-${day}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Could not export data");
    }
  }

  const displayName = bundle?.profile?.display_name ?? user?.name ?? session.name ?? "Your profile";
  const email = bundle?.profile?.email ?? user?.email ?? session.email ?? "";
  const avatarUrl = bundle?.profile?.avatar_url ?? null;
  const langLabel = bundle?.profile?.language === "bn" ? "বাংলা" : "English";
  const preg = bundle?.pregnancy;
  const health = bundle?.health;
  const week = bundle?.computed.gestationalWeek;
  const due = bundle?.computed.displayEdd;

  const subtitle =
    preg?.pregnancy_status === "pregnant" && (week != null || due)
      ? [week != null ? `Week ${week}` : null, due ? `Due ${formatIsoDate(due)}` : null].filter(Boolean).join(" · ")
      : preg?.pregnancy_status
        ? preg.pregnancy_status.replace("_", " ")
        : "Tap edit to add pregnancy details";

  return (
    <AppShell>
      <AppHeader title={t("profile_title")} showBack />

      <div className="space-y-4 px-4 pt-4">
        <SmartHealthNudge />
        <Card className="overflow-hidden border-0 bg-gradient-hero p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 rounded-3xl border border-border/50 shadow-soft">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="" className="rounded-3xl object-cover" />
                ) : null}
                <AvatarFallback className="rounded-3xl bg-card font-display text-xl font-semibold">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft disabled:opacity-50"
                aria-label="Change profile photo"
                disabled={avatarUploading}
                onClick={() => setAvatarDialogOpen(true)}
              >
                {avatarUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold">{displayName}</h1>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
              <Button
                variant="outline"
                size="default"
                className="mt-2 min-h-11 w-full rounded-md px-4 text-sm sm:w-auto"
                type="button"
                disabled={isPending}
                asChild
              >
                <Link href="/profile/edit">
                  <Pencil className="mr-1 h-3 w-3" /> Edit profile
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        <Section title="Pregnancy details">
          <Row icon={Calendar} label="Due date" value={due ? formatIsoDate(due) : "—"} />
          <Row
            icon={Calendar}
            label="Last period (LMP)"
            value={preg?.lmp_date ? formatIsoDate(preg.lmp_date) : "—"}
          />
          <Row icon={Heart} label="Current week" value={week != null ? `Week ${week}` : "—"} />
        </Section>

        <Section title="Health information">
          <Row
            icon={Heart}
            label="Blood group"
            value={
              health?.blood_type && health.blood_type !== "unknown"
                ? health.blood_type
                : health?.blood_type === "unknown"
                  ? "Unknown"
                  : "—"
            }
          />
          <Row
            icon={Heart}
            label="Allergies"
            value={bundle?.allergies?.length ? bundle.allergies.join(", ") : "None recorded"}
          />
          <Row
            icon={Heart}
            label="Conditions"
            value={bundle?.conditions?.length ? bundle.conditions.join(", ") : "—"}
          />
        </Section>

        <Section title="Preferences">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-medium">Language</span>
                <span className="text-sm text-muted-foreground">{langLabel}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup
                value={bundle?.profile?.language ?? user?.language ?? session.language ?? "en"}
                onValueChange={async (v) => {
                  const lang = v as "en" | "bn";
                  const ok = await updateUserLanguage(lang);
                  if (ok) {
                    toast.success(lang === "en" ? "English" : "বাংলা");
                    await refreshSession();
                    refreshFromServer();
                  } else toast.error("Could not update language");
                }}
              >
                <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="bn">বাংলা</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToggleRow
            icon={Bell}
            label="Daily reminders"
            checked={prefs.dailyReminders}
            onCheckedChange={async (v) => {
              const next = { ...prefs, dailyReminders: v };
              setPrefs(next);
              savePrefs(next);
              const res = await fetch("/api/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notifyDailyReminders: v }),
              });
              if (!res.ok) toast.error("Could not save reminder preference");
              else refreshFromServer();
            }}
          />
          <ToggleRow
            icon={Bell}
            label="Community notifications"
            checked={prefs.communityNotifications}
            onCheckedChange={async (v) => {
              const next = { ...prefs, communityNotifications: v };
              setPrefs(next);
              savePrefs(next);
              const res = await fetch("/api/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notifyCommunityActivity: v }),
              });
              if (!res.ok) toast.error("Could not save notification preference");
              else refreshFromServer();
            }}
          />
          <ToggleRow
            icon={Users}
            label="Show extended info on my community profile"
            description="Week and due date summary visible to other signed-in members when they open your profile."
            checked={communityExtended}
            onCheckedChange={async (v) => {
              setCommunityExtended(v);
              const res = await fetch("/api/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ communityShowExtendedProfile: v }),
              });
              if (!res.ok) {
                setCommunityExtended(!v);
                toast.error("Could not update community profile visibility");
                return;
              }
              toast.success(v ? "Extended profile is visible to members" : "Extended profile is hidden");
              refreshFromServer();
            }}
          />
        </Section>

        <Section title="Data & account">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={() => void exportData()}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Download className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm font-medium">Export my data</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={async () => {
              await signOut();
              toast.success("Signed out");
              router.push("/");
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm font-medium text-destructive">Sign out</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>

        {isPending ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        <p className="px-2 pb-2 text-center text-[11px] text-muted-foreground">
          MaaCare · Profile synced with your account 🤍
        </p>
      </div>

      <ProfileAvatarUploadDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        userId={session.id}
        onBusy={setAvatarUploading}
        onUploaded={(publicUrl) => {
          setBundle((prev) => {
            if (!prev.profile) return prev;
            return { ...prev, profile: { ...prev.profile, avatar_url: publicUrl } };
          });
          refreshFromServer();
        }}
      />
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <Card className="divide-y divide-border shadow-soft">{children}</Card>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="max-w-[55%] truncate text-right text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Heart;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex w-full items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch className="mt-1 shrink-0" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
