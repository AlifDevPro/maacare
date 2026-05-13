import { NextResponse } from "next/server";

import { serverErrorJson } from "@/lib/api/error-response";
import {
  getCachedLandingTeamMembers,
  getLandingTeamMembersLive,
  type LandingTeamMemberPublic,
} from "@/lib/team/landing-team-members";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

/** @deprecated Use LandingTeamMemberPublic from `@/lib/team/landing-team-members`. */
export type TeamMemberPublic = LandingTeamMemberPublic;

export async function GET() {
  try {
    const svc = tryCreateSupabaseServiceClient();
    const members = svc ? await getCachedLandingTeamMembers() : await getLandingTeamMembersLive();

    return NextResponse.json(
      { members },
      {
        headers: svc
          ? {
              "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
            }
          : {
              "Cache-Control": "private, no-store",
            },
      },
    );
  } catch (e) {
    return serverErrorJson("team GET", e);
  }
}
