import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { AppointmentsPageClient } from "@/app/appointments/appointments-page-client";
import { getAppointmentsListCached } from "@/lib/app/user-lists-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function AppointmentsPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/appointments");
  }

  const initialItems = await getAppointmentsListCached(session.id, "scheduled", 50);

  return <AppointmentsPageClient initialItems={initialItems} />;
}
