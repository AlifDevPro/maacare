import type { LucideIcon } from "lucide-react";
import { Home, MessageCircle, Stethoscope, Phone, User, Users } from "lucide-react";

export type AppPrimaryNavItem = {
  readonly to: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
};

export const APP_PRIMARY_NAV_ITEMS: readonly AppPrimaryNavItem[] = [
  { to: "/app", labelKey: "home", icon: Home },
  { to: "/chat", labelKey: "chat", icon: MessageCircle },
  { to: "/symptoms", labelKey: "symptoms", icon: Stethoscope },
  { to: "/emergency", labelKey: "emergency", icon: Phone },
  { to: "/community", labelKey: "community", icon: Users },
  { to: "/profile", labelKey: "profile", icon: User },
];

export function isAppPrimaryNavActive(pathname: string, to: string): boolean {
  if (to === "/app") return pathname === "/app";
  if (to === "/profile") return pathname === "/profile" || pathname.startsWith("/profile/");
  return pathname.startsWith(to);
}
