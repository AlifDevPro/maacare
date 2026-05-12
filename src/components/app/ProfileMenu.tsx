"use client";

import Link from "next/link";
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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function ProfileMenu() {
  const { user, loading } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (loading) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50" />
    );
  }

  if (!user) {
    return (
      <Button asChild size="sm" variant="ghost" className="h-9 gap-1.5">
        <Link href="/login">
          <LogIn className="h-4 w-4" />
          <span className="text-sm">Log in</span>
        </Link>
      </Button>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" /> View profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 h-4 w-4" /> Language ({user.language.toUpperCase()})
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={user.language}
              onValueChange={async (v) => {
                const lang = v as "en" | "bn";
                const ok = await updateUserLanguage(lang);
                if (ok) toast.success(`Language: ${lang === "en" ? "English" : "বাংলা"}`);
                else toast.error("Could not update language");
              }}
            >
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bn">বাংলা (Bangla)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
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
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <ShieldCheck className="mr-2 h-4 w-4" /> Admin panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help" className="cursor-pointer">
            <HelpCircle className="mr-2 h-4 w-4" /> Help & support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/docs" className="cursor-pointer">
            <BookOpen className="mr-2 h-4 w-4" /> Documentation
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={async () => {
            await signOut();
            toast.success("Signed out");
            router.push("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
