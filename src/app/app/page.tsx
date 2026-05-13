import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { getSessionFromCookies } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHomeData } from "@/lib/app/home-data";
import { InitialLanguageFromServer } from "@/components/providers/initial-language-from-server";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  noStore();
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const initial = await getHomeData(supabase, session.id, session.name ?? "Member");

  return (
    <InitialLanguageFromServer value={session.language}>
      <HomeClient initial={initial} />
    </InitialLanguageFromServer>
  );
}
