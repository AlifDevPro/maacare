"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  Languages,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  LogIn,
  BookOpen,
  Code2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { signOut, updateUserLanguage, useSession } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function ProfileMenu() {
  const { user, loading } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
      <Button asChild size="sm" variant="ghost" className="h-9 gap-1.5">
        <Link href="/login" prefetch>
          <LogIn className="h-4 w-4" />
          <span className="text-sm">Log in</span>
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Account menu"
        >
          <ProfileMenuAvatar initials={initials} avatarUrl={user.avatarUrl} sizeClass="h-9 w-9" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(70vh,calc(100dvh-6rem))] min-w-[min(100vw-1.25rem,22rem)] max-w-[calc(100vw-1rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:min-w-72 sm:w-auto sm:max-w-none"
      >
        <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3 text-base">
          <ProfileMenuAvatar initials={initials} avatarUrl={user.avatarUrl} sizeClass="h-10 w-10" />
          <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
          <Link href="/profile" prefetch className="cursor-pointer">
            <User className="mr-2 h-4 w-4" /> View profile
          </Link>
        </DropdownMenuItem>
        {user.isTeamDeveloper ? (
          <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
            <Link href="/developer" prefetch className="cursor-pointer">
              <Code2 className="mr-2 h-4 w-4" /> Developer
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer rounded-sm px-2 py-3 text-base">
            <Languages className="mr-2 h-4 w-4" /> Language ({user.language.toUpperCase()})
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={user.language}
              onValueChange={async (v) => {
                const lang = v as "en" | "bn";
                const ok = await updateUserLanguage(lang);
                if (!ok) toast.error("Could not update language");
              }}
            >
              <DropdownMenuRadioItem value="en" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
                English
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bn" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
                বাংলা (Bangla)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer rounded-sm px-2 py-3 text-base">
            {theme === "dark" ? (
              <Moon className="mr-2 h-4 w-4" />
            ) : theme === "light" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Monitor className="mr-2 h-4 w-4" />
            )}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <DropdownMenuRadioItem value="light" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
            <Link href="/admin" prefetch className="cursor-pointer">
              <ShieldCheck className="mr-2 h-4 w-4" /> Admin panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
          <Link href="/settings" prefetch className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
          <Link href="/help" prefetch className="cursor-pointer">
            <HelpCircle className="mr-2 h-4 w-4" /> Help & support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer py-3 text-base">
          <Link href="/docs" prefetch className="cursor-pointer">
            <BookOpen className="mr-2 h-4 w-4" /> Documentation
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(
            "cursor-pointer py-3 text-base text-destructive",
            "focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
            "[&_svg]:text-current",
          )}
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
