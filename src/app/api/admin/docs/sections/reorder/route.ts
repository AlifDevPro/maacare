import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { getDocsAdminClient } from "@/lib/docs-admin/repository";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";

const schema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function POST(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON body.");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const svc = getDocsAdminClient();
    for (let i = 0; i < parsed.data.orderedIds.length; i += 1) {
      const id = parsed.data.orderedIds[i]!;
      const { error } = await svc
        .from("docs_sections")
        .update({ sort_order: (i + 1) * 10, updated_by: gate.userId })
        .eq("id", id);
      if (error) return failJson(500, error.message || "Could not reorder docs sections.");
    }
    revalidateDocsRuntimeCaches();
    return Response.json({ ok: true });
  } catch (e) {
    return serverErrorJson("admin/docs/sections/reorder POST", e);
  }
}

