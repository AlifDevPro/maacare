import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { NotificationsPageClient } from "@/app/notifications/notifications-page-client";
import { getNotificationsPayloadCached } from "@/lib/app/user-lists-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function NotificationsPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/notifications");
  }

  const initial = await getNotificationsPayloadCached(session.id, 80);

  return <NotificationsPageClient initial={initial} />;
}
