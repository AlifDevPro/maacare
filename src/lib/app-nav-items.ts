import type { LucideIcon } from "lucide-react";
import { Home, MessageCircle, Stethoscope, Phone, Users } from "lucide-react";

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
];

export function isAppPrimaryNavActive(pathname: string, to: string): boolean {
  return to === "/app" ? pathname === "/app" : pathname.startsWith(to);
}
