import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PostpartumPageClient } from "@/app/postpartum/postpartum-page-client";
import { getProfileBundleCached } from "@/lib/app/profile-bundle-cache";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { InitialLanguageFromServer } from "@/components/providers/initial-language-from-server";

export default async function PostpartumPage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/postpartum");
  }

  const initialBundle = await getProfileBundleCached(session.id);

  return (
    <InitialLanguageFromServer value={session.language}>
      <PostpartumPageClient initialBundle={initialBundle} />
    </InitialLanguageFromServer>
  );
}
