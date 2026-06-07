import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { normalizeUiLanguagePrior } from "@/lib/ai/language";
import { resolveLanguageFromTextOrPrior } from "@/lib/ai/multilingual-pipeline";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { bustPostpartumInsightCacheForUser, getPostpartumInsightsCached } from "@/lib/postpartum/ai-insights";
import { postpartumWeekFromBirth } from "@/lib/pregnancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in.");

    if (req.nextUrl.searchParams.get("refresh") === "1") {
      bustPostpartumInsightCacheForUser(session.id);
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: preg }, { data: prof }, { data: lastMood }] = await Promise.all([
      supabase
        .from("pregnancy_profiles")
        .select("baby_birth_date, pregnancy_status")
        .eq("user_id", session.id)
        .maybeSingle(),
      supabase.from("profiles").select("language").eq("id", session.id).maybeSingle(),
      supabase
        .from("wellbeing_check_ins")
        .select("mood_key")
        .eq("user_id", session.id)
        .eq("context", "postpartum")
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const birthRaw = (preg as { baby_birth_date?: string | null } | null)?.baby_birth_date ?? null;
    const ppWeek = postpartumWeekFromBirth(birthRaw);
    const pregnancyStatus = (preg as { pregnancy_status?: string | null } | null)?.pregnancy_status ?? null;
    const rawLang = (prof as { language?: string | null } | null)?.language ?? "en";
    const uiLang = normalizeUiLanguagePrior(rawLang);
    const moodKey = (lastMood as { mood_key?: string | null } | null)?.mood_key ?? null;
    const langCtx = await resolveLanguageFromTextOrPrior({
      userText: [
        "postpartum recovery guidance",
        ppWeek != null ? `week ${ppWeek}` : "",
        moodKey ? `mood ${moodKey}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      uiLanguagePrior: uiLang,
    });
    const language = langCtx.ietfLanguageTag;

    const utcDate = new Date().toISOString().slice(0, 10);

    const payload = await getPostpartumInsightsCached({
      userId: session.id,
      utcDate,
      postpartumWeek: ppWeek,
      moodKey,
      language,
      pregnancyStatus,
    });

    return Response.json(payload);
  } catch (e) {
    return serverErrorJson("postpartum_insights GET", e);
  }
}
