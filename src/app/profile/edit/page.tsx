import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ProfileEditClient } from "@/app/profile/edit/profile-edit-client";
import { getProfileBundleCached } from "@/lib/app/profile-bundle-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";

export default async function ProfileEditPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/profile/edit");
  }

  const initialBundle = await getProfileBundleCached(session.id);

  return <ProfileEditClient initialBundle={initialBundle} session={session} />;
}
