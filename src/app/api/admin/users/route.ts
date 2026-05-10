import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { escapeIlike } from "@/lib/community/aggregate-counts";

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

    return Response.json({ users: data ?? [], total: count ?? 0 });
  } catch (e) {
    return serverErrorJson("admin/users GET", e);
  }
}
