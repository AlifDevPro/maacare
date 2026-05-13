"use client";

import Link from "next/link";
import {
  ChevronRight,
  KeyRound,
  Monitor,
  Moon,
  Sun,
  User,
  UserPen,
  FileText,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";

export default function SettingsPage() {
  const { user, loading } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <AppShell>
      <AppHeader title="Settings" showBack backHref="/app" />
      <div className="space-y-4 px-4 pt-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences. Medical details stay on your profile.
        </p>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Profile</CardTitle>
            <CardDescription>View or edit your MaaCare profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="h-11 justify-between rounded-xl px-4" asChild>
              <Link href="/profile">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  View profile
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <Button variant="outline" className="h-11 justify-between rounded-xl px-4" asChild>
              <Link href="/profile/edit">
                <span className="flex items-center gap-2">
                  <UserPen className="h-4 w-4" />
                  Edit medical profile
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Account</CardTitle>
            <CardDescription>Sign-in email and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {loading ? "…" : user?.email ?? "—"}
              </p>
            </div>
            <Button variant="outline" className="h-11 w-full justify-between rounded-xl px-4" asChild>
              <Link href="/forgot-password">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Change password
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              We&apos;ll email you a secure link to set a new password. You stay signed in on other devices until you
              complete it.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Appearance</CardTitle>
            <CardDescription>Same options as the account menu in the header.</CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 w-full justify-between rounded-xl px-4">
                  <span className="flex items-center gap-2">
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : theme === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                    Theme: {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(100vw-2rem,20rem)]">
                <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Your data</CardTitle>
            <CardDescription>Download a copy of what we show on your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="h-11 w-full justify-between rounded-xl px-4" asChild>
              <Link href="/profile">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Open profile to export
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              On your profile, use <strong className="font-medium text-foreground/90">Export my data</strong> to save a
              readable summary (Markdown) to your device.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
