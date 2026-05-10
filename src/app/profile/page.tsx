"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";

import type { ProfileBundle } from "@/app/profile/profile-types";
import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatIsoDate } from "@/lib/profile/computed";
import { refreshSession, signOut, updateUserLanguage, useSession } from "@/lib/auth-client";
import { toast } from "sonner";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>({
    dailyReminders: true,
    communityNotifications: true,
  });

  const fetchBundle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (res.status === 401) {
        setBundle(null);
        return;
      }
      if (!res.ok) throw new Error("Could not load profile");
      const data = (await res.json()) as ProfileBundle;
      setBundle(data);
    } catch {
      toast.error("Could not load your profile");
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    const p = bundle?.profile;
    if (!p) return;
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

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) void fetchBundle();
  }, [user, fetchBundle]);

  function initials(name: string) {
    return name
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  }

  async function exportData() {
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maacare-profile-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Could not export data");
    }
  }

  const displayName = bundle?.profile?.display_name ?? user?.name ?? "Your profile";
  const email = bundle?.profile?.email ?? user?.email ?? "";
  const langLabel = bundle?.profile?.language === "bn" ? "বাংলা" : "English";
  const preg = bundle?.pregnancy;
  const health = bundle?.health;
  const week = bundle?.computed.gestationalWeek;
  const due = bundle?.computed.displayEdd;

  const subtitle =
    preg?.pregnancy_status === "pregnant" && (week != null || due)
      ? [
          week != null ? `Week ${week}` : null,
          due ? `Due ${formatIsoDate(due)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : preg?.pregnancy_status
        ? preg.pregnancy_status.replace("_", " ")
        : "Tap edit to add pregnancy details";

  if (authLoading || !user) {
    return (
      <AppShell>
        <AppHeader title="Profile" showBack />
        <div className="space-y-4 px-4 pt-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="Profile" showBack />

      <div className="space-y-4 px-4 pt-4">
        <Card className="overflow-hidden border-0 bg-gradient-hero p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-card font-display text-xl font-semibold shadow-soft">
                {initials(displayName)}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft opacity-60"
                aria-label="Photo coming soon"
                disabled
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold">{displayName}</h1>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 rounded-full text-xs"
                type="button"
                disabled={loading}
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
          <Row
            icon={Calendar}
            label="Due date"
            value={due ? formatIsoDate(due) : "—"}
          />
          <Row
            icon={Calendar}
            label="Last period (LMP)"
            value={preg?.lmp_date ? formatIsoDate(preg.lmp_date) : "—"}
          />
          <Row
            icon={Heart}
            label="Current week"
            value={week != null ? `Week ${week}` : "—"}
          />
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
            value={
              bundle?.allergies?.length
                ? bundle.allergies.join(", ")
                : "None recorded"
            }
          />
          <Row
            icon={Heart}
            label="Conditions"
            value={
              bundle?.conditions?.length
                ? bundle.conditions.join(", ")
                : "—"
            }
          />
        </Section>

        <Section title="Preferences">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
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
                value={bundle?.profile?.language ?? user?.language ?? "en"}
                onValueChange={async (v) => {
                  const lang = v as "en" | "bn";
                  const ok = await updateUserLanguage(lang);
                  if (ok) {
                    toast.success(lang === "en" ? "English" : "বাংলা");
                    await fetchBundle();
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
              else await fetchBundle();
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
              else await fetchBundle();
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

        {loading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <p className="px-2 pb-2 text-center text-[11px] text-muted-foreground">
          MaaCare · Profile synced with your account 🤍
        </p>
      </div>
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
  checked,
  onCheckedChange,
}: {
  icon: typeof Heart;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
