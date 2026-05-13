import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ProfilePageClient } from "@/app/profile/profile-page-client";
import { getProfileBundleCached } from "@/lib/app/profile-bundle-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { InitialLanguageFromServer } from "@/components/providers/initial-language-from-server";

export default async function ProfilePage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/profile");
  }

  const initialBundle = await getProfileBundleCached(session.id);

  return (
    <InitialLanguageFromServer value={session.language}>
      <ProfilePageClient session={session} initialBundle={initialBundle} />
    </InitialLanguageFromServer>
  );
}
