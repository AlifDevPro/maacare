import { NextResponse } from "next/server";

import { serverErrorJson } from "@/lib/api/error-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeamMemberPublic = {
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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
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
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[api/team]", error);
      return NextResponse.json({ members: [] satisfies TeamMemberPublic[] }, { status: 200 });
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

    const members: TeamMemberPublic[] = (data ?? []).map((raw) => {
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

    return NextResponse.json(
      { members },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    return serverErrorJson("team GET", e);
  }
}
