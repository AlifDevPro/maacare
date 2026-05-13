import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

/** Public landing / API shape for published team cards. */
export type LandingTeamMemberPublic = {
  userId: string;
  name: string;
  jobTitle: string;
  bio: string;
  imageUrl: string | null;
  social: {
    github: string | null;
    twitter: string | null;
    linkedin: string | null;
    website: string | null;
  };
  sortOrder: number;
};

export const LANDING_TEAM_CACHE_TAG = "landing-team";

async function fetchPublishedTeamRows(supabase: SupabaseClient) {
  return supabase
    .from("developer_team_profiles")
    .select(
      `
        user_id,
        card_display_name,
        job_title,
        bio,
        photo_url,
        social_github,
        social_twitter,
        social_linkedin,
        social_website,
        sort_order,
        profiles ( display_name, avatar_url )
      `,
    )
    .eq("published", true)
    .eq("show_on_team_section", true)
    .order("sort_order", { ascending: true });
}

type Row = {
  user_id: string;
  card_display_name: string | null;
  job_title: string;
  bio: string;
  photo_url: string | null;
  social_github: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_website: string | null;
  sort_order: number;
  profiles: { display_name: string; avatar_url: string | null } | { display_name: string; avatar_url: string | null }[] | null;
};

function mapRowsToMembers(data: unknown[] | null): LandingTeamMemberPublic[] {
  return (data ?? []).map((raw) => {
    const r = raw as Row;
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const displayName = (r.card_display_name?.trim() || p?.display_name?.trim() || "Team member").trim();
    const image = r.photo_url?.trim() || p?.avatar_url || null;
    return {
      userId: r.user_id,
      name: displayName,
      jobTitle: r.job_title?.trim() || "Contributor",
      bio: r.bio?.trim() || "",
      imageUrl: image,
      social: {
        github: r.social_github?.trim() || null,
        twitter: r.social_twitter?.trim() || null,
        linkedin: r.social_linkedin?.trim() || null,
        website: r.social_website?.trim() || null,
      },
      sortOrder: r.sort_order,
    };
  });
}

/** Loads published team rows (no HTTP cache). Uses service role when available, otherwise the server cookie client. */
export async function getLandingTeamMembersLive(): Promise<LandingTeamMemberPublic[]> {
  const svc = tryCreateSupabaseServiceClient();
  const supabase = svc ?? (await createSupabaseServerClient());
  const { data, error } = await fetchPublishedTeamRows(supabase);

  if (error) {
    console.error("[landing-team-members]", error);
    return [];
  }
  return mapRowsToMembers(data ?? []);
}

async function loadLandingTeamMembersForServerCache(): Promise<LandingTeamMemberPublic[]> {
  const svc = tryCreateSupabaseServiceClient();
  if (!svc) {
    console.warn("[landing-team-members] skipping server cache: SUPABASE_SERVICE_ROLE_KEY not set");
    return [];
  }
  const { data, error } = await fetchPublishedTeamRows(svc);
  if (error) {
    console.error("[landing-team-members cache]", error);
    return [];
  }
  return mapRowsToMembers(data ?? []);
}

/** Cached listing; only use when `SUPABASE_SERVICE_ROLE_KEY` is configured (see `getLandingTeamMembersLive` fallback). */
export const getCachedLandingTeamMembers = unstable_cache(
  loadLandingTeamMembersForServerCache,
  ["landing-team-members-v1"],
  { tags: [LANDING_TEAM_CACHE_TAG] },
);

/** Call after any mutation that changes who appears on the home team section or their cards. */
export function revalidateLandingTeamCache() {
  revalidateTag(LANDING_TEAM_CACHE_TAG, { expire: 0 });
}
