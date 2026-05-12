import { NextRequest } from "next/server";

import { failJson, serverErrorJson } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const status = req.nextUrl.searchParams.get("status")?.trim() ?? "all";
    const limit = Math.min(Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "40") || 40), 100);
    const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? "0") || 0);

    let q = gate.supabase
      .from("app_feedback")
      .select(
        `
        id,
        created_at,
        user_id,
        kind,
        message,
        context,
        status,
        admin_notes,
        profiles (
          display_name,
          email
        )
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "new" || status === "triaged" || status === "resolved") {
      q = q.eq("status", status);
    }

    const { data, error, count } = await q;

    if (error) {
      console.error("[admin/feedback GET]", error);
      return failJson(500, "Could not load feedback.");
    }

    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const prof = r.profiles as { display_name?: string; email?: string } | null;
      const p = Array.isArray(prof) ? prof[0] : prof;
      return {
        id: r.id as string,
        createdAt: r.created_at as string,
        userId: r.user_id as string | null,
        userLabel: p?.display_name?.trim() || p?.email || "Member",
        kind: r.kind as string,
        message: r.message as string,
        context: r.context as Record<string, unknown>,
        status: r.status as string,
        adminNotes: (r.admin_notes as string | null) ?? null,
      };
    });

    return Response.json({ items: rows, total: count ?? 0 });
  } catch (e) {
    return serverErrorJson("admin/feedback GET", e);
  }
}
