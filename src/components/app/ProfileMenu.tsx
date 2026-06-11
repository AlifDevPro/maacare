"use client";

import Link from "next/link";
import { memo, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  ArrowLeft,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  LogIn,
  BookOpen,
  Code2,
  Crown,
  Pencil,
} from "lucide-react";
import { GlobalLanguageSwitcher } from "@/components/app/global-language-switcher";
import { InstantLink } from "@/components/app/instant-link";
import { prefetchProfileBundle } from "@/lib/app/profile-bundle-query";
import {
  ProfileMenuIconSegment,
  ProfileMenuSegment,
  ProfileMenuSegmentGroup,
} from "@/components/app/profile-menu-segments";
import { useProfileMenuOpen } from "@/components/app/profile-menu-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AppShellInsetSheetContent } from "@/components/app/app-shell-inset-sheet";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { signOut, updateUserLanguage, useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type MenuAvatarProps = {
  initials: string;
  avatarUrl?: string | null;
  sizeClass: string;
};

const ProfileMenuAvatar = memo(function ProfileMenuAvatar({ initials, avatarUrl, sizeClass }: MenuAvatarProps) {
  return (
    <Avatar className={cn("border border-border", sizeClass)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials}</AvatarFallback>
    </Avatar>
  );
});

function ProfileMenuLinks({
  user,
  onNavigate,
  t,
}: {
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  onNavigate?: () => void;
  t: (key: string) => string;
}) {
  const linkClass = "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/80 active:bg-muted";

  return (
    <>
      <InstantLink href="/profile" className={linkClass} onClick={onNavigate}>
        <User className="h-4 w-4 shrink-0" /> {t("view_profile")}
      </InstantLink>
      <InstantLink href="/profile/edit" className={linkClass} onClick={onNavigate}>
        <Pencil className="h-4 w-4 shrink-0" /> {t("edit_profile")}
      </InstantLink>
      {user.isTeamDeveloper ? (
        <InstantLink href="/developer" className={linkClass} onClick={onNavigate}>
          <Code2 className="h-4 w-4 shrink-0" /> {t("developer")}
        </InstantLink>
      ) : null}
      {user.role === "admin" ? (
        <InstantLink href="/admin" className={linkClass} onClick={onNavigate}>
          <ShieldCheck className="h-4 w-4 shrink-0" /> {t("admin_panel")}
        </InstantLink>
      ) : null}
      <InstantLink href="/subscription" className={linkClass} onClick={onNavigate}>
        <Crown className="h-4 w-4 shrink-0" /> {t("subscription")}
      </InstantLink>
      <InstantLink href="/settings" className={linkClass} onClick={onNavigate}>
        <Settings className="h-4 w-4 shrink-0" /> {t("settings")}
      </InstantLink>
      <InstantLink href="/help" className={linkClass} onClick={onNavigate}>
        <HelpCircle className="h-4 w-4 shrink-0" /> {t("help_support")}
      </InstantLink>
      <InstantLink href="/docs" className={linkClass} onClick={onNavigate}>
        <BookOpen className="h-4 w-4 shrink-0" /> {t("documentation")}
      </InstantLink>
    </>
  );
}

function ProfileMenuPreferences({
  user,
  t,
}: {
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  t: (key: string) => string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3 px-1">
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("language_section")}
        </p>
        <ProfileMenuSegmentGroup aria-label={t("language_section")}>
          <ProfileMenuSegment
            active={user.language === "en"}
            onClick={() => void updateUserLanguage("en").then((ok) => !ok && toast.error(t("toast_language_error")))}
            aria-label={t("language_english")}
          >
            EN
          </ProfileMenuSegment>
          <ProfileMenuSegment
            active={user.language === "bn"}
            onClick={() => void updateUserLanguage("bn").then((ok) => !ok && toast.error(t("toast_language_error")))}
            aria-label={t("language_bangla")}
          >
            বাং
          </ProfileMenuSegment>
        </ProfileMenuSegmentGroup>
      </div>
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("theme_section")}
        </p>
        <ProfileMenuSegmentGroup aria-label={t("theme_section")}>
          <ProfileMenuIconSegment
            active={theme === "light"}
            onClick={() => setTheme("light")}
            icon={Sun}
            label={t("theme_light")}
          />
          <ProfileMenuIconSegment
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            icon={Moon}
            label={t("theme_dark")}
          />
          <ProfileMenuIconSegment
            active={theme === "system"}
            onClick={() => setTheme("system")}
            icon={Monitor}
            label={t("theme_system")}
          />
        </ProfileMenuSegmentGroup>
      </div>
    </div>
  );
}

function ProfileMenuPanel({
  user,
  initials,
  onClose,
}: {
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  initials: string;
  onClose?: () => void;
}) {
  const { t } = useTranslation("shell");
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/60 px-3 pb-3 pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="group h-9 w-9 shrink-0"
            aria-label={t("back_aria")}
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
          </Button>
          <p className="font-display text-xl font-semibold tracking-tight">{t("account_menu_aria")}</p>
        </div>
        <div className="flex items-center gap-3 px-1">
          <ProfileMenuAvatar initials={initials} avatarUrl={user.avatarUrl} sizeClass="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <div className="space-y-1">
          <ProfileMenuLinks user={user} onNavigate={onClose} t={t} />
        </div>
        <div className="my-3 border-t border-border/60" />
        <ProfileMenuPreferences user={user} t={t} />
      </div>

      <div className="shrink-0 border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-base font-medium text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15"
          onClick={async () => {
            onClose?.();
            await signOut();
            router.push("/");
          }}
        >
          <LogOut className="h-4 w-4" /> {t("sign_out")}
        </button>
      </div>
    </div>
  );
}

function ProfileMenuTriggerButton({
  initials,
  avatarUrl,
  open,
  label,
  onClick,
}: {
  initials: string;
  avatarUrl?: string | null;
  open: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full outline-none ring-offset-background transition-[box-shadow,transform] duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        open && "ring-2 ring-primary ring-offset-2",
      )}
      aria-label={label}
      aria-expanded={open}
    >
      <ProfileMenuAvatar initials={initials} avatarUrl={avatarUrl} sizeClass="h-9 w-9" />
    </button>
  );
}

export function ProfileMenu() {
  const { t } = useTranslation("shell");
  const { user, loading } = useSession();
  const { open, setOpen } = useProfileMenuOpen();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open || !user) return;
    router.prefetch("/profile");
    router.prefetch("/profile/edit");
    router.prefetch("/settings");
    void prefetchProfileBundle(queryClient);
    void import("@/app/profile/edit/profile-edit-client");
  }, [open, queryClient, router, user]);

  const initials = useMemo(() => {
    if (!user) return "";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  if (loading) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50" />
    );
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <GlobalLanguageSwitcher align="end" />
        <Button asChild size="sm" variant="ghost" className="h-9 gap-1.5">
          <Link href="/login" prefetch>
            <LogIn className="h-4 w-4" />
            <span className="text-sm">{t("log_in")}</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ProfileMenuTriggerButton
        initials={initials}
        avatarUrl={user.avatarUrl}
        open={open}
        label={t("account_menu_aria")}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <AppShellInsetSheetContent
          showCloseButton={false}
          className="z-[60] flex h-full w-full max-w-full flex-col gap-0 p-0"
        >
          <SheetTitle className="sr-only">{t("account_menu_aria")}</SheetTitle>
          <ProfileMenuPanel user={user} initials={initials} onClose={() => setOpen(false)} />
        </AppShellInsetSheetContent>
      </Sheet>
    </>
  );
}
