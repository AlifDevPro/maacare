import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ProfilePageClient } from "@/app/profile/profile-page-client";
import { getProfileBundleCached } from "@/lib/app/profile-bundle-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function ProfilePage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/profile");
  }

  const initialBundle = await getProfileBundleCached(session.id);

  return <ProfilePageClient session={session} initialBundle={initialBundle} />;
}
