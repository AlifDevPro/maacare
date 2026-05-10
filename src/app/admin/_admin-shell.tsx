"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BookOpen,
  Settings as SettingsIcon,
  Home,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { toast } from "sonner";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/community", label: "Community", icon: MessageSquare },
  { to: "/admin/knowledge", label: "Knowledge base", icon: BookOpen },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "admin") {
      toast.error("Admin access required");
      router.push("/");
    }
  }, [router, user, loading]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar p-4 md:flex">
          <Link href="/" className="mb-6 flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-rose">🤍</span>
            <div>
              <p className="font-display text-base font-semibold leading-none">MaaCare</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Admin</p>
            </div>
          </Link>
          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active =
                "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 border-t border-border/60 pt-3">
            <Button asChild variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
              <Link href="/app">
                <Home className="h-4 w-4" /> Back to app
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>
        <div className="flex-1 overflow-x-hidden">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-5 backdrop-blur-xl md:hidden">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-rose text-sm">
                🤍
              </span>
              <span className="font-display font-semibold">Admin</span>
            </Link>
          </header>
          <div className="p-5 md:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
