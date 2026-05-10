import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  language: "en" | "bn";
};

export async function getSessionFromCookies(): Promise<PublicUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, email, role, language")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return {
    id: user.id,
    name: profile.display_name,
    email: profile.email ?? user.email ?? "",
    role: profile.role as PublicUser["role"],
    language: profile.language === "bn" ? "bn" : "en",
  };
}
