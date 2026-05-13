"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import type { ReactNode } from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageBell } from "./MessageBell";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";

interface AppHeaderProps {
  title?: ReactNode;
  showBack?: boolean;
  /** When set, back navigates here instead of browser history. */
  backHref?: string;
  showNotifications?: boolean;
  /** When omitted, follows `showNotifications` (bell and messages together). */
  showMessages?: boolean;
  showMenu?: boolean;
  right?: ReactNode;
  brand?: boolean;
  className?: string;
}

export function AppHeader({
  title,
  showBack,
  backHref,
  showNotifications,
  showMessages,
  showMenu,
  right,
  brand,
  className,
}: AppHeaderProps) {
  const { t } = useTranslation("shell");
  const router = useRouter();
  const messagesEnabled = showMessages ?? showNotifications ?? false;
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBack &&
          (backHref ? (
            <Button size="icon" variant="ghost" className="group shrink-0" asChild>
              <Link href={backHref} aria-label="Back">
                <ArrowLeft className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
              </Link>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="group shrink-0"
              onClick={() => router.back()}
              aria-label={t("back_aria")}
            >
              <ArrowLeft className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
            </Button>
          ))}
        {showMenu && (
          <Button size="icon" variant="ghost" className="group shrink-0" aria-label={t("menu_aria")}>
            <Menu className="h-5 w-5 transition-transform duration-150 ease-out group-active:scale-110 motion-reduce:group-active:scale-100" />
          </Button>
        )}
        {brand ? (
          <Link href="/app" className="flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-rose text-base shadow-soft">
              🤍
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">MaaCare</span>
          </Link>
        ) : (
          <h1 className="truncate font-display text-base font-semibold">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {right}
        {showNotifications && <NotificationBell />}
        {messagesEnabled && <MessageBell />}
        <ProfileMenu />
      </div>
    </header>
  );
}
