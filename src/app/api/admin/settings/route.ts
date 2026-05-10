import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";

const FLAGS = ["ai_chat", "community", "reports", "emergency"] as const;
type FlagKey = (typeof FLAGS)[number];

const patchSchema = z.object({
  key: z.enum(FLAGS),
  enabled: z.boolean(),
});

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    const { data, error } = await gate.supabase
      .from("admin_feature_flags")
      .select("key, enabled");

    if (error) {
      console.error("[admin/settings GET]", error);
      return failJson(500, "Could not load settings.");
    }

    const byKey = new Map<string, boolean>();
    for (const row of data ?? []) {
      byKey.set(String(row.key), Boolean(row.enabled));
    }

    const flags: Record<FlagKey, boolean> = {
      ai_chat: byKey.get("ai_chat") ?? true,
      community: byKey.get("community") ?? true,
      reports: byKey.get("reports") ?? true,
      emergency: byKey.get("emergency") ?? true,
    };

    return Response.json({ flags });
  } catch (e) {
    return serverErrorJson("admin/settings GET", e);
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      return failJson(400, "Invalid JSON body.");
    }
    const parsed = patchSchema.safeParse(bodyUnknown);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const { key, enabled } = parsed.data;
    const { error } = await gate.supabase
      .from("admin_feature_flags")
      .upsert({ key, enabled, updated_by: gate.userId }, { onConflict: "key" });

    if (error) {
      console.error("[admin/settings PATCH]", error);
      return failJson(500, "Could not update setting.");
    }

    return Response.json({ ok: true, key, enabled });
  } catch (e) {
    return serverErrorJson("admin/settings PATCH", e);
  }
}
