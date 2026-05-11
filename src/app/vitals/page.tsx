import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { VitalsPageClient } from "@/app/vitals/vitals-page-client";
import { getVitalsListCached } from "@/lib/app/user-lists-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function VitalsPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/vitals");
  }

  const initialItems = await getVitalsListCached(session.id, 40);

  return <VitalsPageClient initialItems={initialItems} />;
}
