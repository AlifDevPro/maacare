import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { listUserMedicalReports } from "@/lib/reports/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Please sign in and try again.");

    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const supabase = await createSupabaseServerClient();
    const { items, total } = await listUserMedicalReports(supabase, session.id, {
      search,
      limit,
      offset,
    });

    return Response.json({ items, total });
  } catch (e) {
    return serverErrorJson("reports GET", e);
  }
}
