import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { escapeIlike } from "@/lib/community/aggregate-counts";
import { tryCreateSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const qRaw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "25") || 25), 100);
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? "0") || 0);

    const roleRaw = req.nextUrl.searchParams.get("role")?.trim().toLowerCase() ?? "";
    const roleFilter =
      roleRaw === "user" || roleRaw === "moderator" || roleRaw === "admin" ? roleRaw : null;

    let query = gate.supabase
      .from("profiles")
      .select("id, email, display_name, role, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (roleFilter) {
      query = query.eq("role", roleFilter);
    }

    if (qRaw.length > 0) {
      const esc = escapeIlike(qRaw);
      query = query.or(`email.ilike.%${esc}%,display_name.ilike.%${esc}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[admin/users]", error);
      return failJson(500, "Could not load users.");
    }

    const profiles = data ?? [];
    const svc = tryCreateSupabaseServiceClient();

    let users: Array<(typeof profiles)[number] & { email_confirmed_at: string | null }>;
    if (!svc) {
      users = profiles.map((p) => ({ ...p, email_confirmed_at: null }));
    } else {
      const authResults = await Promise.all(
        profiles.map((p) => svc.auth.admin.getUserById(p.id)),
      );
      users = profiles.map((p, i) => ({
        ...p,
        email_confirmed_at: authResults[i]?.data?.user?.email_confirmed_at ?? null,
      }));
    }

    return Response.json({
      users,
      total: count ?? 0,
      authEnrichmentAvailable: !!svc,
    });
  } catch (e) {
    return serverErrorJson("admin/users GET", e);
  }
}
