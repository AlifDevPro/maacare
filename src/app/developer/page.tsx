import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { DeveloperPageClient } from "@/app/developer/developer-page-client";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function DeveloperPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/developer");
  }
  if (!session.isTeamDeveloper) {
    redirect("/app");
  }

  return <DeveloperPageClient />;
}
