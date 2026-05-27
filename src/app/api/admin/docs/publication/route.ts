import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { requireDbAdmin } from "@/lib/auth/require-db-admin";
import { revalidateDocsRuntimeCaches } from "@/lib/docs-runtime/snapshot";
import { getDocsAdminClient } from "@/lib/docs-admin/repository";
import { getDocsPublicationSettings } from "@/lib/docs-runtime/access";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  overridePublicWindow: z.boolean().optional(),
});

export async function GET() {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;
    const publication = await getDocsPublicationSettings();
    return Response.json({ publication });
  } catch (e) {
    return serverErrorJson("admin/docs/publication GET", e);
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireDbAdmin();
    if (!gate.ok) return gate.response;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return failJson(400, "Invalid JSON body.");
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const payload = parsed.data;
    const svc = getDocsAdminClient();
    const { error } = await svc
      .from("docs_publication_settings")
      .upsert(
        {
          key: "primary",
          ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
          ...(payload.startAt !== undefined ? { start_at: payload.startAt } : {}),
          ...(payload.endAt !== undefined ? { end_at: payload.endAt } : {}),
          ...(payload.durationMinutes !== undefined ? { duration_minutes: payload.durationMinutes } : {}),
          ...(payload.overridePublicWindow !== undefined
            ? { override_public_window: payload.overridePublicWindow }
            : {}),
          updated_by: gate.userId,
        },
        { onConflict: "key" },
      );

    if (error) return failJson(500, error.message || "Could not update publication settings.");
    revalidateDocsRuntimeCaches();
    const publication = await getDocsPublicationSettings();
    return Response.json({ ok: true, publication });
  } catch (e) {
    return serverErrorJson("admin/docs/publication PATCH", e);
  }
}

